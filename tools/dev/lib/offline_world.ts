// dev: the game's walkable world built headless in node for the walk bots (H workstream): the same colliders as
// src/world/world.ts builds them in the browser, from the same builders, and the same player controller and call order as
// main.ts simStep. What is in:
//  - the terrain: streamed per-chunk heightfields (physics.ts), the drawn surface;
//  - the Terrace: every part's collider, the working doors (DoorSystem: swinging, schedules, people opening them), the
//    inscription stones that are solid (D-214), the waterworks' kerbs, the palaces' furnishings (D-212);
//  - the town, Tol-e Ajori, the precinct and the burial ground (Settlement, streamed colliders), the plain (villages,
//    trees, Naqsh-e Rustam, rivers: lazy colliders), the court's camps (court setting on: UD-10);
//  - people: the 135 detailed agents (a capsule each) and the population out of doors near the player (PopView), solid by
//    solids.ts as in the game; animals: the fauna (dogs, game, boar, the court's teams, the stair foot's lines) solid by
//    solids.ts.
// What is NOT in (the browser walkthrough has them): the crowd's performers' animals (flocks, plough teams: they need the
// skinned crowd), and the crowd's roots (people stand at the view's spot, not the animation's root, up to ~1 m apart).
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { Physics } from '../../../src/player/physics';
import { Player } from '../../../src/player/player';
import { loadTerrain } from '../../../tests/plainLib';
import { buildTerrace } from '../../../src/arch/terrace';
import { buildMeshes } from '../../../src/arch/meshes';
import { DoorSystem } from '../../../src/arch/doors';
import { buildWaterworks } from '../../../src/arch/waterworks';
import { buildInscriptions, loadInscriptionFonts, buildPhase4Reliefs } from '../../../src/arch/decor';
import { PalaceFurnishings } from '../../../src/world/furnish_palaces';
import { FireSystem } from '../../../src/world/fire';
import { Settlement } from '../../../src/world/settlement/build';
import { buildPlain } from '../../../src/world/plain';
import { villageCompounds } from '../../../src/world/plain/villages';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { PopGeo } from '../../../src/people/popgeo';
import { PopView } from '../../../src/people/popview';
import { CAMPS } from '../../../src/people/camps';
import { sunTimes } from '../../../src/people/calendar';
import { CourtCampTents } from '../../../src/world/courtCamps';
import { Fauna, type VillageIn } from '../../../src/world/fauna';
import { NearSolids } from '../../../src/world/solids';
import { WeatherSystem } from '../../../src/weather/weatherState';
import type { Terrain } from '../../../src/terrain/heightfield';

const bin = (p: string) => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

export interface OfflineWorld {
  T: Terrain; P: Physics; scene: THREE.Scene; nav: NavGrid; sim: PeopleSim | null; view: PopView | null; settlement: Settlement | null;
  plain: Awaited<ReturnType<typeof buildPlain>> | null; doors: DoorSystem; solids: NearSolids; fauna: Fauna | null; geo: PopGeo | null;
  /** the bodies of people and animals (the detailed agents' capsules and the solids pools): drawn in the game as people */
  livingBodies: Set<number>;
  /** world time in sim hours */
  t: number;
  /** one step in main.ts simStep order: stream, move, step, rescue; then the world (people, doors, solids) */
  step(pl: Player, dt: number, input: { forward: number; yaw: number; run?: boolean }): void;
  /** put a new player at world (x, z) on the floor there */
  spawn(x: number, z: number, floorHint?: number): Player;
  buildMs: number;
}

export async function buildOfflineWorld(o: { seed?: number; day?: number; hour?: number; court?: boolean; town?: boolean; plain?: boolean; people?: boolean } = {}): Promise<OfflineWorld> {
  const t0 = Date.now(), seed = o.seed ?? 1, court = o.court ?? true;
  const T = loadTerrain(), P = await Physics.create(), scene = new THREE.Scene();
  P.updateTerrain(T, { x: 0, y: 0, z: 0 });
  // the Terrace (world.ts order)
  const { parts, manifest, doorways } = buildTerrace();
  const arch = buildMeshes(parts, P, { dynamicDoors: true }); scene.add(arch.group);
  const doors = new DoorSystem(parts, P); scene.add(doors.group);
  await loadInscriptionFonts(async p => bin(p));
  const p4 = buildPhase4Reliefs(doorways); const insc = buildInscriptions(manifest, parts, p4.inscriptions); scene.add(insc);
  const inscSolids = (insc.userData.solids ?? []) as { c: [number, number]; size: [number, number]; y0: number; y1: number }[];
  for (const s of inscSolids) P.addBox({ x: s.c[0], y: (s.y0 + s.y1) / 2, z: -s.c[1] }, { x: s.size[0] / 2, y: (s.y1 - s.y0) / 2, z: s.size[1] / 2 });
  const waterworks = buildWaterworks(parts, (e, n) => T.heightAt(e, -n)); scene.add(waterworks.group);
  for (const c of waterworks.colliders) P.addBox({ x: c.c.x, y: c.c.y, z: c.c.z }, { x: c.half.x, y: c.half.y, z: c.half.z });
  const palace = new PalaceFurnishings(parts, manifest, doorways, { court, phys: P }); scene.add(palace.group);
  const fire = new FireSystem(2);
  const settlement = o.town === false ? null : new Settlement(P, T, fire, 'test'); if (settlement) scene.add(settlement.group);
  const plain = o.plain === false ? null : await buildPlain(scene, T, P, { quality: 'test', seed, town: settlement?.plan ?? null,
    camps: court ? CAMPS.filter(c => c.id !== 'court').map(c => ({ c: c.c, r: c.r })) : [], drains: waterworks.plan.drains.map(d => ({ at: d.at as [number, number], n: d.n as [number, number] })),
    fetchJson: async p => JSON.parse(readFileSync('public/' + p, 'utf8')) });
  if (plain) scene.add(plain.group);
  const nav = await NavGrid.load(async p => bin(p));
  for (const [e, n, r] of palace.navDiscs()) nav.blockDisc(e, n, r);
  for (const s of inscSolids) nav.blockDisc(s.c[0], s.c[1], Math.hypot(s.size[0], s.size[1]) / 2);
  for (const [e, n, r] of waterworks.navDiscs) nav.blockDisc(e, n, r);
  const W = new WeatherSystem(seed), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const solids = new NearSolids(P);
  let sim: PeopleSim | null = null, view: PopView | null = null, geo: PopGeo | null = null, fauna: Fauna | null = null;
  let agentBodies: ReturnType<Physics['world']['createRigidBody']>[] = [];
  const t = 24 * (o.day ?? 25) + (o.hour ?? 10);
  if (o.people !== false) {
    sim = new PeopleSim(seed, nav, env, { court }); sim.routeSearchesPerStep = 4; sim.jumpTo(t);
    if (sim.pop.court) { const tents = new CourtCampTents(sim.pop.court.tents, (e, n) => T.heightAt(e, -n), P); scene.add(tents.group); }
    if (plain) { geo = new PopGeo({ pop: sim.pop, nav, town: settlement?.plan ?? null, ground: (e, n) => T.heightAt(e, -n), seed,
      villages: plain.data.villages, compounds: vi => villageCompounds(plain.data.villages[vi], T, seed), canals: plain.data.canals.map(c => c.pts) });
      view = new PopView(sim, geo, seed); }
    const R = P.R; agentBodies = sim.agents.map(() => { const b = P.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -1000, 0)); P.world.createCollider(R.ColliderDesc.capsule(0.55, 0.25).setTranslation(0, 0.8, 0), b); return b; });
    if (plain) { const groundAt = (e: number, n: number) => (nav.walkable(e, n) ? nav.heightAt(e, n) : T.heightAt(e, -n));
      const villagesIn: VillageIn[] = plain.data.villages.map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, T, seed) }));
      fauna = new Fauna(seed, settlement?.plan ?? null, villagesIn, groundAt, { rivers: plain.data.rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2 })), canals: plain.data.canals.map(c => c.pts as [number, number][]) });
      if (sim.pop.court) { const cc = CAMPS.find(c => c.id === 'court'); if (cc) fauna.addCourtVehicles(cc.c as [number, number], cc.r); }
      fauna.animals.onPush = (a, M) => solids.animal(a, M); scene.add(fauna.group); }
  }
  P.step(1 / 60);
  let viewT = 1e9, plainT = 1e9;
  const w: OfflineWorld = {
    T, P, scene, nav, sim, view, settlement, plain, doors, solids, fauna, geo, t, buildMs: Date.now() - t0,
    livingBodies: new Set([...agentBodies, ...solids.bodies()].map(b => b.handle)),
    spawn(x, z, floorHint) {
      P.updateTerrain(T, { x, y: 0, z }); settlement?.streamColliders(x, z, Infinity);
      if (plain) plain.update(0, ctxAt(x, T.heightAt(x, z), z)); P.step(1e-4);
      const from = floorHint !== undefined ? floorHint + 1.2 : T.heightAt(x, z) + 60;
      const y = P.castRayDown(x, z, from) ?? T.heightAt(x, z);
      const pl = new Player(P, x, y + 0.02, z); viewT = plainT = 1e9; return pl;
    },
    step(pl, dt, inp) {
      const pp = pl.position;
      w.t += dt / 3600;
      // the world as world.simulate does it
      if (sim) { sim.player = [pp.x, -pp.z]; sim.step(dt); agentBodies.forEach((b, i) => { const a = sim!.agents[i]; b.setNextKinematicTranslation(a.offmap ? { x: 0, y: -1000, z: 0 } : { x: a.pos[0], y: a.y, z: -a.pos[1] }); }); }
      doors.player = new THREE.Vector3(pp.x, pp.y, pp.z) as any; doors.people = sim ? sim.agents.filter(a => !a.offmap).map(a => a.pos as [number, number]) : [];
      if ((viewT += dt) >= 0.25) { viewT = 0; // a rendered frame's view-dependent work (people placed, animals pushed), 4 a second
        if (view) { view.update(sim!.t, [pp.x, -pp.z]); for (const vp of view.visible) if (vp.moving && vp.e > -80 && vp.e < 280 && vp.n > -250 && vp.n < 250) doors.people.push([vp.e, vp.n]); }
        if (fauna) { const day = Math.floor(sim!.t / 24), hour = sim!.t - day * 24; solids.beginAnimals(); fauna.update({ t: w.t * 3600, hour, day, month: 4, sun: sunTimes(day), player: [pp.x, -pp.z], cam: { x: pp.x, y: pp.y + 1.6, z: pp.z }, dt: 0.25, rain: 0 }); } }
      doors.update(dt, (sim ? sim.t : w.t) % 24);
      solids.begin(pp); if (view) for (const vp of view.query([pp.x, -pp.z], 20)) if (vp.agent < 0) solids.person(vp.e, vp.y, -vp.n); solids.end();
      settlement?.streamColliders(pp.x, pp.z);
      if (plain && (plainT += dt) >= 0.5) { plainT = 0; plain.update(0, ctxAt(pp.x, pp.y, pp.z)); }
      // the player: main.ts simStep order
      P.updateTerrain(T, pp);
      pl.update(dt, { forward: inp.forward, right: 0, run: !!inp.run, yaw: inp.yaw, pitch: 0 });
      P.step(Math.max(1 / 240, dt));
      pl.rescueIfUnderground((a, b) => T.surfaceAt(a, b));
    },
  };
  const ctxAt = (x: number, y: number, z: number) => ({ clock: { dayIndex: o.day ?? 25, localHour: o.hour ?? 10 }, cond: { windMs: 2, windDirDeg: 0 }, camera: { position: new THREE.Vector3(x, y + 1.6, z) }, player: { position: new THREE.Vector3(x, y, z) } });
  return w;
}
