// D-210: the animals the gap audit found missing (REVIEWS/gap_audit.md items 5, 6, 10, 11, 15, 16, 17): the dogs, the
// animals that travel (pack strings, camels, couriers, ox carts, the delegations' animals), the fowl, the paradise's game
// and the river's boar, and their voices. Measured in node (no browser render): the species and their data rows, the
// riding pose on the rig against the mount's back, the closed-form placements, the counts on the built town plan and the
// villages against population.json and fauna.json, where each animal is (yards, open ground, inside the paradise wall, off
// the Terrace), the travellers against the simulation's own caravan, deliveries and couriers, the soundscape's schedule,
// and the draw and triangle costs (bench-reports/fauna.json).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { SPECIES, ANIMAL_BUILD, animalsFor, mountSeat, riderLift, CART_AT, animalGeometry, type Species } from '../src/people/animals';
import { ACTIVITIES, performanceFor } from '../src/people/activities';
import { pose, RIDE } from '../src/people/anim';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../src/people/humanRig';
import { PART } from '../src/people/humanFormat';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { toLocal, ROOM } from '../src/world/settlement/site';
import { Fauna, openGround, FAUNA, type FaunaCtx, type VillageIn } from '../src/world/fauna';
import { Traffic, along, type Mover } from '../src/world/traffic';
import { villageCompounds, placeVillages } from '../src/world/plain/villages';
import { buildCanals } from '../src/world/plain/canals';
import { loadTerrain, loadRiversFile } from './plainLib';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { sunTimes } from '../src/people/calendar';
import { BIRDS as SOUND_BIRDS, STRIKE_KINDS, ambientWeight, type Place } from '../src/audio/soundscape';
import { partyAnimals } from '../src/people/court';
import { DELEGATIONS as RELIEF_DELEGATIONS } from '../src/arch/relief_figures';
import { crowAt, BIRDS as WILD_BIRDS, type BirdPose } from '../src/world/wildlife';
import popData from '../src/data/population.json';
import faunaData from '../src/data/fauna.json';
import sources from '../src/data/sources.json';
import delegationsData from '../src/data/delegations.json';
import footprints from '../src/data/geo/footprints.json';

const OUT: Record<string, unknown> = {};
const save = () => { mkdirSync('bench-reports', { recursive: true }); let old: Record<string, unknown> = {}; try { old = JSON.parse(readFileSync('bench-reports/fauna.json', 'utf8')); } catch { /* first */ } writeFileSync('bench-reports/fauna.json', JSON.stringify({ ...old, ...OUT }, null, 1)); };
const inside = (poly: number[][], e: number, n: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
const TERRACE = (footprints as any).terrace.polygon as number[][];
/** the town plot cell at a grid point: { plot index, sub, site } or null (lane, open ground) */
const cellAt = (plan: TownPlan, e: number, n: number) => { for (const s of plan.sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; const k = s.k(i, j), c = s.cell[k]; if (c >= 0) return { c, sub: s.sub[k], s }; } return null; };

let plan: TownPlan, fauna: Fauna, villages: VillageIn[], A: HumanAssets, sim: PeopleSim, traffic: Traffic, terrain: ReturnType<typeof loadTerrain>;
beforeAll(() => {
  plan = buildTownPlan(); terrain = loadTerrain(); const rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1);
  villages = placeVillages(terrain, rivers.rivers, canals, 1).map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, terrain, 1) }));
  const t0 = performance.now();
  fauna = new Fauna(1, plan, villages, (e, n) => terrain.heightAt(e, -n), { rivers: rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2 })), canals: canals.map(c => c.pts as [number, number][]) });
  OUT.faunaBuildMs = +(performance.now() - t0).toFixed(0);
  const b = readFileSync('public/generated/humans/humans.bin'); A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env); traffic = new Traffic(1, sim.pop as any, plan);
}, 240_000);

describe('the species (D-210): each stands for a data row; the riding pose sits on the mount', () => {
  it('every species names a row of population.json animals or fauna.json (cattle: Q-193); every fauna.json source resolves', () => {
    const PJ = new Set((popData as any).animals.map((a: any) => a.id as string)), FJ = new Set(Object.keys(faunaData).filter(k => k !== '_meta'));
    for (const sp of SPECIES) { const r = ANIMAL_BUILD[sp].row; expect(sp === 'ox' || PJ.has(r) || FJ.has(r), `${sp}: row ${r}`).toBe(true); }
    for (const [k, v] of Object.entries(faunaData)) if (k !== '_meta') { for (const s of String((v as any).src).split(';')) expect((sources as any)[s], `${k}: ${s}`).toBeTruthy(); expect(['A', 'B', 'C']).toContain((v as any).tier); }
    expect(PJ.has('dog') && PJ.has('poultry') && PJ.has('mule') && PJ.has('camel')).toBe(true);
  });
  it('the rider sits on the mount’s back (±3 cm) at every body the crowd draws, and no leg passes more than 3 cm into the barrel', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), o = [0, 0, 0], rows: string[] = [];
    for (const v of A.variants) {
      const inp: RigInput = { joints: v.joints, pose: pose('ride', 1.3, 0, 0.3), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0.5, 0.5], x: 0, y: 0, z: 0, yaw: 0, scale: 1 } as RigInput;
      rig.setPose(inp); rig.solve(inp, pal, 0); let seat = 9; const legs: number[][] = [];
      for (let i = 0; i < A.NO; i += 2) { const pt = A.part[i]; if (pt >= PART.eye) continue; skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o);
        if (pt === PART.pelvis || pt === PART.thigh_l || pt === PART.thigh_r) seat = Math.min(seat, o[1]);
        if ([PART.thigh_l, PART.thigh_r, PART.calf_l, PART.calf_r, PART.foot_l, PART.foot_r].includes(pt as any)) legs.push([o[0], o[1], o[2]]); }
      for (const sp of ['horse_saddle', 'donkey'] as Species[]) { const B = ANIMAL_BUILD[sp], S = mountSeat(sp), lift = riderLift(sp, v.height), bodyY = B.h - B.girth * 0.5, rx = B.girth * 0.46, ry = B.girth * 0.52, rz = B.len * 0.5;
        let pen = 0; for (const p of legs) { const q = (p[0] / rx) ** 2 + ((p[1] + lift - bodyY) / ry) ** 2 + ((p[2] + S.z) / rz) ** 2; if (q < 1) pen = Math.max(pen, (1 - Math.sqrt(q)) * Math.min(rx, ry)); }
        const err = seat + lift - S.y; expect(Math.abs(err), `${v.meta.id} on ${sp}: seat`).toBeLessThan(0.03); expect(pen, `${v.meta.id} on ${sp}: legs in the barrel`).toBeLessThan(0.03);
        if (sp === 'horse_saddle') rows.push(`${v.meta.id} ${v.height.toFixed(2)} m: seat ${(seat / v.height).toFixed(3)} × stature (RIDE.seatK ${RIDE.seatK}), error ${(err * 100).toFixed(1)} cm, leg depth ${(pen * 100).toFixed(1)} cm`); } }
    OUT.ride = rows; save();
  });
  it('the new animals build within the species budget; the pack and saddle gear ride on the body, not below the belly', () => {
    const tris: Record<string, number> = {}; for (const sp of SPECIES) { const g = animalGeometry(sp), n = g.getAttribute('position').count / 3; tris[sp] = n; expect(n, sp).toBeLessThanOrEqual(1100);
      g.computeBoundingBox(); expect(g.boundingBox!.min.y, sp).toBeGreaterThan(-0.01); }
    OUT.speciesTriangles = tris; save();
  });
});

describe('closed-form placement of the animals with their people (D-210)', () => {
  it('a string walks nose to tail behind its driver at his pace; a mount stands under its rider; the draught pair ahead of the cart', () => {
    const S = animalsFor({ kind: 'string', species: ['donkey_pack', 'mule_pack'], n: 5, pace: 1 }, 100, 3); expect(S.length).toBe(5);
    for (let i = 1; i < 5; i++) { expect(S[i].z).toBeLessThan(S[i - 1].z - 1); expect(S[i].walk).toBe(1); }
    expect(S[0].z).toBeLessThan(-1); expect(Math.abs(S[4].z)).toBeLessThan(14);
    const still = animalsFor({ kind: 'string', species: ['donkey_pack'], n: 5, pace: 0, side: -0.9, lead: -1.2 }, 50, 3); expect(still.every(a => a.walk === 0)).toBe(true); expect(still[0].z).toBeGreaterThan(0);
    const m = animalsFor({ kind: 'mount', species: ['horse_saddle'], pace: 1.8 }, 10, 1)[0]; expect(m.x).toBe(0); expect(m.z).toBeCloseTo(-mountSeat('horse_saddle').z); expect(m.walk).toBe(1);
    const d = animalsFor({ kind: 'draught', species: ['ox', 'ox'], pace: 0.9 }, 10, 1); expect(d.length).toBe(2); const oxBack = d[0].z - ANIMAL_BUILD.ox.len / 2;
    expect(oxBack - (CART_AT[2] + 1.1), 'the oxen stand clear ahead of the cart bed').toBeGreaterThan(0.2); expect(ACTIVITIES.walk.variants!.find(v => /ox cart/.test(String(v.when)))!.work![0].at[2]).toBe(CART_AT[2]);
  });
  it('two dogs with every flock: within 14 m of the herdsman, never faster than a trot (2.5 m/s)', () => {
    let prev = animalsFor({ kind: 'flock', species: ['sheep'], n: 6, dogs: 2 }, 0, 5).filter(a => a.sp === 'dog'); expect(prev.length).toBe(2);
    for (let t = 0.25; t < 2000; t += 0.25) { const cur = animalsFor({ kind: 'flock', species: ['sheep'], n: 6, dogs: 2 }, t, 5).filter(a => a.sp === 'dog');
      cur.forEach((a, i) => { expect(Math.hypot(a.x, a.z - 2)).toBeLessThan(14); expect(Math.hypot(a.x - prev[i].x, a.z - prev[i].z) / 0.25).toBeLessThan(2.5); expect(a.walk * a.lie).toBe(0); }); prev = cur; }
    expect(ACTIVITIES.herd.animals!.dogs).toBe(2);
  });
  it('the simulation’s reasons and the travellers’ select the intended animals', () => {
    const cases: [any, string, string, Species | undefined][] = [
      ['walk', 'leading a string of pack donkeys with the caravan to the Treasury (the day’s goods)', 'walk', 'donkey_pack'], ['walk', 'leading a string of Bactrian camels with the caravan to the Treasury', 'walk', 'camel_pack'],
      ['walk', 'a courier riding in to the road station on a relay horse (E-20)', 'ride', 'horse_saddle'], ['walk', 'driving an ox cart of grain to the storehouse (E-06)', 'walk', 'ox'],
      ['walk', 'leading the unloaded string back to the state stable', 'walk', 'donkey'], ['walk', 'going to the well', 'walk', undefined],
      ['tend_animals', 'holding the string at the stair foot while the porters take the loads up', 'hold_lead', 'donkey_pack'], ['tend_animals', 'holding the camels at the stair foot while the porters take the loads up', 'hold_lead', 'camel_pack'],
      ['tend_animals', 'seeing to the party’s animals: the Bactrian camel', 'groom', 'camel'], ['tend_animals', 'seeing to the party’s animals: the humped bull', 'groom', 'zebu'],
      ['tend_animals', 'seeing to the party’s animals: the dromedary', 'groom', 'dromedary'], ['tend_animals', 'seeing to the party’s animals: the horses', 'groom', 'horse'],
      ['tend_animals', 'tending the relay horses', 'groom', 'horse'], ['carry_sack', 'taking down the tents and loading the donkeys', 'carry_shoulder', 'donkey_pack']];
    for (const [act, why, anim, sp] of cases) { const P = performanceFor(act, why, 5); expect(P.anim, why).toBe(anim); expect(P.animals?.species[0], why).toBe(sp); }
    let ride = 0; for (let s = 0; s < 400; s++) if (performanceFor('train', 'learning to ride and to shoot with the bow (HDT 1.136)', s).anim === 'ride') ride++;
    expect(ride / 400).toBeGreaterThan(0.25); expect(ride / 400).toBeLessThan(0.45);
  });
  it('the delegations’ animals: delegations.json follows the relief carving; each party’s why draws its animal (or its pack animals)', () => {
    const peoples = (delegationsData as any).peoples as any[];
    for (const p of peoples) { const r = RELIEF_DELEGATIONS.find(d => d.n === p.relief)!; expect(p.animal, p.id).toBe(r.animal); }
    const drawn: Record<string, string> = {};
    for (const p of peoples) { const why = `seeing to the party’s animals: ${partyAnimals({ petition: false, origin: p.origin })}`, P = performanceFor('tend_animals', why, 3); drawn[p.id] = P.animals!.species[0];
      if (['lioness', 'okapi', 'ibex'].includes(p.animal) || !p.animal) expect(why).toMatch(/pack animals/); }
    expect(partyAnimals({ petition: true, origin: 'Median' })).toBe('the pack animals'); OUT.delegationAnimals = drawn; save();
  });
});

describe('the animals about the town, the villages, the paradise and the river (world/fauna.ts)', () => {
  const ctx = (t: number, hour: number, player: [number, number] | null = null, cam: [number, number] = [-900, -300]): FaunaCtx => ({ t, hour, month: 5, sun: { rise: 5.8, set: 19.4 }, player, cam: { x: cam[0], y: 0, z: -cam[1] }, dt: 0.1, rain: 0 });
  it('the counts fall inside population.json’s ranges for the town (dogs 100-400 with the herdsmen’s dogs; poultry 100-500 in the state yard) and fauna.json’s shares', () => {
    const c = fauna.counts(), herd = 2 * (sim.pop as any).shepherds.length, town = c.yardDogsTown + c.stableDogs + c.strays + herd;
    const pr = (id: string) => (popData as any).animals.find((a: any) => a.id === id).count_town_court_absent as [number, number];
    expect(town).toBeGreaterThanOrEqual(pr('dog')[0]); expect(town).toBeLessThanOrEqual(pr('dog')[1]);
    expect(c.poultryYard).toBeGreaterThanOrEqual(pr('poultry')[0]); expect(c.poultryYard).toBeLessThanOrEqual(pr('poultry')[1]);
    expect(c.yardDogsVillage).toBeGreaterThan(50); expect(c.henYards).toBeGreaterThan(300); expect(c.deer).toBe(8); expect(c.gazelle).toBe(11); expect(c.boar).toBe(4);
    OUT.counts = { ...c, herdDogs: herd, townDogs: town, villages: villages.length, villageCompounds: villages.reduce((a, v) => a + v.comps.length, 0) }; save();
  });
  it('yard dogs and hens stay in their yards (open cells of their own plot, never a room); strays on open ground; the poultry yard on open ground', () => {
    let checked = 0;
    for (let i = 0; i < fauna.yardDogs.length; i += 7) { const d = fauna.yardDogs[i]; if (d.where === 'village') continue; const o: any = {};
      const home = cellAt(plan, d.yard.bed[0], d.yard.bed[1]); expect(home, `dog ${i}`).not.toBeNull();
      for (let t = 0; t < 3600 * 6; t += 97) { fauna.yardDogAt(i, ctx(t, 7 + t / 3600), o); const c = cellAt(plan, o.e, o.n); expect(c?.c, `dog ${i} at ${o.e.toFixed(1)},${o.n.toFixed(1)}`).toBe(home!.c); expect(c!.sub).not.toBe(ROOM); checked++; } }
    for (const s of fauna.strays) for (const p of s.spots) expect(openGround(plan, p[0], p[1])).toBe(true);
    expect(fauna.poultry).not.toBeNull(); expect(openGround(plan, fauna.poultry!.c[0], fauna.poultry!.c[1])).toBe(true);
    OUT.yardChecks = checked; save();
  });
  it('the game stays inside the paradise’s wall, lies up at midday and draws off from a person on foot; the boar keeps to the river margin off the town', () => {
    const par = plan.sites.find(s => s.id === 'paradise')!, o: any = {}; let lie = 0, n = 0;
    for (let t = 0; t < 86400 * 3; t += 331) { const hour = (t / 3600) % 24; for (const [k, m] of [['deer', 8], ['gazelle', 11]] as const) for (let j = 0; j < m; j++) { fauna.gameAt(k, j, ctx(t, hour), o);
      const [u, v] = toLocal(par.frame, o.e, o.n); expect(Math.abs(u), `${k} ${j}`).toBeLessThan(par.W / 2 - 4); expect(Math.abs(v)).toBeLessThan(par.H / 2 - 4); if (hour > 12 && hour < 15) { n++; lie += o.lie; } } }
    expect(lie / n).toBeGreaterThan(0.4);
    fauna.gameAt('deer', 0, ctx(5000, 9), o); const p: [number, number] = [o.e + 3, o.n]; fauna.gameAt('deer', 0, ctx(5000, 9, p), o); expect(Math.hypot(o.e - p[0], o.n - p[1])).toBeGreaterThan(8);
    expect(fauna.boarPath.length).toBeGreaterThan(10); for (const q of fauna.boarPath) { expect(cellAt(plan, q[0], q[1])).toBeNull(); expect(Math.hypot(q[0] + 1600, q[1] - 2400)).toBeLessThan(3000); }
  });
  it('by day hens peck in the yards, at night they are indoors; a dog barks at the visitor near its yard; the cocks crow at first light', () => {
    const cam: [number, number] = [-900, -300], near = fauna.yardDogs.findIndex(d => d.where === 'town' && Math.hypot(d.yard.bed[0] - cam[0], d.yard.bed[1] - cam[1]) < 250); expect(near).toBeGreaterThanOrEqual(0);
    fauna.update(ctx(40000, 11, null, cam)); const day = { ...fauna.stats.bySpecies }; expect(day.hen ?? 0).toBeGreaterThan(5); expect(day.dog ?? 0).toBeGreaterThan(3);
    fauna.update(ctx(40000, 23, null, cam)); expect(fauna.stats.bySpecies.hen ?? 0).toBe(0);
    const bed = fauna.yardDogs[near].yard.bed, sounds: string[] = []; fauna.onSound = k => sounds.push(k); const before = fauna.stats.barks;
    for (let k = 0; k < 150; k++) fauna.update({ ...ctx(50000 + k * 0.1, 14, [bed[0] + 6, bed[1]], bed), dt: 0.1 }); expect(fauna.stats.barks - before, 'barks at the visitor in 15 s').toBeGreaterThan(3);
    const crowsBefore = fauna.stats.crows; for (let k = 0; k < 600; k++) fauna.update({ ...ctx(60000 + k * 0.5, 5.3, null, cam), dt: 0.5 }); expect(fauna.stats.crows - crowsBefore).toBeGreaterThan(3);
    fauna.onSound = undefined; expect(sounds.every(k => (STRIKE_KINDS as readonly string[]).includes(k))).toBe(true);
  });
  it('costs: draws and triangles at a busy town spot by day, at the poultry yard and at the paradise (bench-reports/fauna.json)', () => {
    const rows: Record<string, unknown> = {};
    const spots: [string, [number, number], number][] = [['town quarter W at noon', [-900, -300], 12], ['the poultry yard at 10:00', fauna.poultry!.c, 10], ['the paradise at 8:00', plan.sites.find(s => s.id === 'paradise')!.frame.c as [number, number], 8], ['a village at 9:00', [villages[0].x, villages[0].y], 9], ['the river at 21:00', fauna.boarPath[10], 21]];
    for (const [name, at, hour] of spots) { fauna.update(ctx(30000, hour, null, at)); const s = fauna.animals.stats(); rows[name] = { draws: s.draws, instances: s.instances, triangles: s.triangles, species: s.species, dropped: s.dropped };
      expect(s.dropped).toBe(0); expect(s.draws).toBeLessThanOrEqual(8); expect(s.triangles).toBeLessThan(400_000); }
    OUT.costs = rows; save(); console.log(JSON.stringify(rows));
  });
});

describe('the animals that travel with their drivers and riders (world/traffic.ts)', () => {
  it('the routes keep to the roads, off the Terrace and every town plot', () => {
    for (const [k, R] of Object.entries(traffic.routes)) for (let s = 0; s <= R.len; s += 3) { const p = along(R, s);
      expect(inside(TERRACE, p.e, p.n), `${k} at ${s} m: on the Terrace`).toBe(false); const c = cellAt(plan, p.e, p.n);
      if (c) expect(s > R.len - 3 || s < 3, `${k} at ${s} m (${p.e.toFixed(0)},${p.n.toFixed(0)}) in a plot of ${c.s.id}`).toBe(true); }
  });
  it('the caravan’s strings reach the stair foot at the hour the porters expect it, hold there, and leave for the stable; camels on about one day in six', () => {
    let days = 0, camels = 0, checked = 0; const stair = along(traffic.routes.caravanIn, 1e9);
    for (let d = 0; d < 360; d += 1) { const cv = sim.pop.caravan(d); if (!cv) continue; days++;
      const at = traffic.at(d * 24 + cv.h + 0.05); const hold = at.filter(m => m.key.startsWith(`cv${d}:`)); expect(hold.length, `day ${d}`).toBeGreaterThan(0);
      expect(hold.every(m => m.act === 'tend_animals')).toBe(true); expect(Math.hypot(hold[0].e - stair.e, hold[0].n - stair.n)).toBeLessThan(2);
      if (hold.some(m => m.kind === 'camel')) camels++;
      const before = traffic.at(d * 24 + cv.h - 0.25).filter(m => m.key.startsWith(`cv${d}:0`)); expect(before.length).toBe(1); expect(before[0].act).toBe('walk'); expect(Math.hypot(before[0].e - stair.e, before[0].n - stair.n)).toBeGreaterThan(700);
      const after = traffic.at(d * 24 + cv.h + 0.6).filter(m => m.key.startsWith(`cv${d}:`)); expect(after.every(m => /unload|unladen/.test(m.why))).toBe(true); checked++; }
    expect(days).toBeGreaterThan(250); expect(camels / days).toBeGreaterThan(0.08); expect(camels / days).toBeLessThan(0.28); OUT.caravan = { days, camelDays: camels }; save();
  });
  it('the grain deliveries come up the south road to the storehouse at the hour E-06 gives; the couriers ride in to the stable at E-20’s hour', () => {
    let del = 0, cour = 0, carts = 0, onward = 0; const gate = along(traffic.routes.storeIn, 1e9), stable = along(traffic.routes.courierIn, 1e9);
    for (let d = 0; d < 360; d += 3) { const C = sim.pop.cal.ctx(d);
      C.deliveries.forEach((x, k) => { if (x.place !== 'royal_store' && x.place !== 'store_town') return; del++; const m = traffic.at(d * 24 + x.t + 0.01).filter(q => q.key.startsWith(`dl${d}:${k}:`));
        expect(m.length).toBeGreaterThan(0); expect(Math.hypot(m[0].e - gate.e, m[0].n - gate.n)).toBeLessThan(2); carts += m.filter(q => q.kind === 'cart').length; });
      C.couriers.forEach((x, k) => { cour++; const m = traffic.at(d * 24 + x.t - 0.02).find(q => q.key === `cu${d}:${k}`); if (x.t - 0.02 < 0) return;
        expect(m, `day ${d} courier ${k}`).toBeDefined(); expect(Math.hypot(m!.e - stable.e, m!.n - stable.n)).toBeLessThan(0.02 * 3600 * 1.8 + 2); expect(m!.act).toBe('walk');
        if (!x.treasury) { onward++; expect(traffic.at(d * 24 + x.t + 0.45).some(q => q.key === `co${d}:${k}`)).toBe(true); } }); }
    expect(del).toBeGreaterThan(10); expect(cour).toBeGreaterThan(10); OUT.travel = { deliveries: del, carts, couriers: cour, onward }; save();
  });
});

describe('the soundscape’s animals (D-210)', () => {
  const P = (o: Partial<Place>): Place => ({ town: 0, water: 0, trees: 0, midden: 0, animals: 0, ...o });
  const W = (id: string, c: any) => ambientWeight(SOUND_BIRDS.find(b => b.id === id)!, c);
  it('the cocks at first light in the town only; frogs by the water on spring evenings; cicadas among trees in the summer heat; owls at night; the barks and brays are strike kinds', () => {
    const sun = { rise: 5.6, set: 19.6 };
    expect(W('cocks at first light', { hour: 5.0, month: 4, place: P({ town: 1 }), sun })).toBe(1); expect(W('cocks at first light', { hour: 11, month: 4, place: P({ town: 1 }), sun })).toBe(0);
    expect(W('cocks at first light', { hour: 5.0, month: 4, place: P({}), sun })).toBe(0);
    expect(W('marsh frogs', { hour: 21, month: 3, place: P({ water: 0.8 }) })).toBeCloseTo(0.8); expect(W('marsh frogs', { hour: 21, month: 8, place: P({ water: 1 }) })).toBe(0); expect(W('marsh frogs', { hour: 12, month: 3, place: P({ water: 1 }) })).toBe(0);
    expect(W('cicadas', { hour: 14, month: 6, tempC: 31, place: P({ trees: 1 }) })).toBe(1); expect(W('cicadas', { hour: 14, month: 6, tempC: 22, place: P({ trees: 1 }) })).toBe(0); expect(W('cicadas', { hour: 14, month: 11, tempC: 31, place: P({ trees: 1 }) })).toBe(0);
    expect(W('scops owl', { hour: 23, month: 5, place: P({ trees: 1 }) })).toBe(1); expect(W('scops owl', { hour: 12, month: 5, place: P({ trees: 1 }) })).toBe(0);
    for (const k of ['bray', 'bark', 'cluck', 'cockcrow', 'grunt']) expect(STRIKE_KINDS as readonly string[]).toContain(k);
  });
  it('the listener’s surroundings: the town among the houses, water by the river, trees in the paradise, dung at a midden', () => {
    const m = plan.middens.find(q => q.kind === 'midden')!, par = plan.sites.find(s => s.id === 'paradise')!.frame.c;
    expect(fauna.placeAt(m.c[0], m.c[1]).midden).toBeGreaterThan(0.9); expect(fauna.placeAt(m.c[0], m.c[1]).town).toBeGreaterThan(0.5);
    expect(fauna.placeAt(par[0], par[1]).trees).toBeGreaterThan(0.5); expect(fauna.placeAt(fauna.boarPath[5][0], fauna.boarPath[5][1]).water).toBeGreaterThan(0.8);
    expect(fauna.placeAt(2200, -1200).town).toBe(0); // the mountain
  });
  it('the crows keep to the middens by day and lift off from a person within 8 m', () => {
    const mids = plan.middens.filter(q => q.kind === 'midden').map(q => q.c), p: BirdPose = { pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false }; let ground = 0, n = 0;
    for (let t = 0; t < 20000; t += 37) for (let i = 0; i < WILD_BIRDS.crow.count; i++) { crowAt(mids, () => 0, 1, i, t, false, p); n++; if (p.flap === 0) { ground++; expect(mids.some(c => Math.hypot(c[0] - p.pos.x, c[1] + p.pos.z) < 9)).toBe(true); } }
    expect(ground / n).toBeGreaterThan(0.6); crowAt(mids, () => 0, 1, 0, 100, true, p); expect(p.pos.y).toBeGreaterThan(4);
  });
});
void sunTimes;
