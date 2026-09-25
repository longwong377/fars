// D-215 (gap audit items 4, 21, 22, 26, 37; D-207): babies in arms and small children held by the hand, children's play
// and the toys left in yards, ornaments by rank, the guards' wicker shield and the royal spearmen's gilded butts, eye paint
// for the court, the court women's dress, and the lame and the blind. Everything drawn is read from the simulation's own
// state (the plans' `with` and words, ages, households); nothing here changes a plan. Measured, not eyeballed: the numbers
// go to bench-reports/people-children.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { monthsOld } from '../src/people/population';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { TOYS_SHARE } from '../src/world/settlement/quarter';
import { PopGeo } from '../src/people/popgeo';
import { PopView, IMPAIR, CHILD_H, handReach, HAND_SNAP, propOf, type ViewPerson } from '../src/people/popview';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from './plainLib';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, earLobes, BRACELET_AT, COSTUME_OF, COSTUMES, pieceBit, type OutfitBuild, type Dress } from '../src/people/outfits';
import { lookFor, JEWELS } from '../src/people/looks';
import { unpackLookBits, HB } from '../src/people/humanFormat';
import { HumanGPU } from '../src/people/humanGPU';
import { PALETTE_STRIDE } from '../src/people/humanRig';
import { Crowd } from '../src/people/crowd';
import { ACTIVITIES, performanceFor, type ActivityId } from '../src/people/activities';
import { babeMode, babeKind, babeLength, BABE_MODES, HOLD, type BabeMode } from '../src/people/babes';
import { PROP_CLASSES, propUnionGeometry, BABE_CLASS, PROP_NOTES, propSlot } from '../src/people/props';
import { playPath, PLAY_PATH, WORK_META } from '../src/people/workAnims';
import { WORK_NOTES } from '../src/people/workObjects';
import { surface, type Frag } from '../tools/dev/human_cpu';
import { MAT } from '../src/people/humanFormat';

let sim: PeopleSim, plan: TownPlan, view: PopView, A: HumanAssets, O: OutfitBuild;
const W = new WeatherSystem(1);
const NOTES: Record<string, unknown> = {};
const note = (k: string, v: unknown) => { NOTES[k] = v; mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/people-children.json', JSON.stringify(NOTES, null, 1)); };
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
beforeAll(async () => {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  sim = new PeopleSim(1, nav, env); plan = buildTownPlan(); const terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1);
  const villages = placeVillages(terrain, rivers.rivers, canals, 1);
  const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
  view = new PopView(sim, geo, 1);
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), dresses: ['persian', 'woman', 'median', 'child', 'worker'] });
}, 600_000);

/** a crowd over a stand-in view: the given people (sex, age) and their views, fed by hand as the pool would */
function crowdWith(people: Record<number, { sex: 'm' | 'f'; age: number; dress?: Dress }>) {
  const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 32 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
  const crowd = new Crowd(null, 1, humans), persons: any[] = [];
  for (const [k, v] of Object.entries(people)) persons[+k] = { sex: v.sex };
  crowd.view = { lookInput: (pid: number) => { const q = people[pid]; return { id: 100000 + pid, sex: q.sex, role: q.age < 12 ? 'child' : 'grinder', dress: q.dress ?? (q.age < 12 ? 'child' : q.sex === 'f' ? 'woman' : 'worker'), origin: 'Persian', seed: 5000 + pid * 31, age: q.age < 12 ? 'child' : 'adult' }; },
    childStature: (pid: number) => people[pid].age < 12 ? CHILD_H[people[pid].age] : null, geo: { plotAt: () => 0 }, stats: {}, lastT: 10, pop: { persons, nameOf: () => null, ageOn: (pid: number) => people[pid].age } } as any;
  return crowd;
}
const vpOf = (pid: number, act: ActivityId, why: string, o: Partial<ViewPerson> = {}): ViewPerson =>
  ({ pid, e: 0, n: 6, y: 0, heading: 180, act, moving: false, why, place: '', prop: propOf(act, null), carryNote: null, speed: 0, entry: 0, what: 'test', agent: -1, plot: 0, wall: 0, hh: -1, babes: [], hand: 0, impair: 0, ...o });
const cam = () => { const c = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); c.position.set(0, 1.6, 0); c.lookAt(0, 1.2, -6); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; };
/** a bone head of an attached person in character space at the body's scale (the palette is the rig's, unscaled: the
 *  root and the look's scale are applied per instance on the GPU; the props' transforms are scaled character space) */
function boneOf(crowd: Crowd, key: string, b: number) {
  const p = crowd.persons.get(key)!, pal = crowd.humans.gpu.palette, o = p.slot * PALETTE_STRIDE, J = A.variants[p.look.variant].joints, m = pal.subarray(o + b * 12, o + b * 12 + 12);
  const x = J[b * 3], y = J[b * 3 + 1], z = J[b * 3 + 2];
  return new THREE.Vector3(m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]).multiplyScalar(p.look.scale);
}

describe('babies in arms and small children by the hand (gap audit item 4)', () => {
  it('the plan’s own words choose how the child is held (babes.ts babeMode)', () => {
    const cases: [string, ActivityId, ActivityId, boolean, boolean, BabeMode][] = [
      ['carried on the mother’s back', 'rest', 'walk', true, false, 'back'], ['asleep, carried on the mother’s back', 'sleep', 'carry_jar_head', true, false, 'back'],
      ['on the mother’s back while she works', 'rest', 'reap', false, false, 'back'], ['carried at the mother’s front', 'rest', 'walk', true, false, 'front'],
      ['nursed by the mother', 'eat', 'rest', false, true, 'nurse'], ['nursed by the mother', 'eat', 'talk', false, false, 'arms'],
      ['in the mother’s lap', 'rest', 'rest', false, true, 'lap'], ['in the grandmother’s lap', 'rest', 'talk', false, false, 'hip'],
      ['lying on a mat beside the mother while she works', 'rest', 'grind', false, false, 'mat'], ['asleep on a mat beside the mother while she works', 'sleep', 'weave', false, true, 'cradle'],
      ['carried by the elder sister', 'rest', 'walk', true, false, 'hip'], ['carried by the mother', 'rest', 'carry_jar_head', true, false, 'back'],
      ['a midday sleep near the grandmother', 'sleep', 'spin', false, true, 'cradle'], ['asleep beside the mother, who is ill', 'sleep', 'lie_ill', false, true, 'cradle'],
    ];
    for (const [why, act, cAct, mv, home, want] of cases) expect(babeMode(why, act, cAct, mv, home), why).toBe(want);
    expect(babeKind('back', 1).kind).toBe('babe_wrapped_sling'); expect(babeKind('hip', 8).kind).toBe('babe'); expect(babeKind('cradle', 5).kind).toBe('babe_cradle');
    expect(babeLength(0)).toBeCloseTo(0.5, 3); expect(babeLength(12)).toBeCloseTo(0.75, 3); expect(babeLength(24)).toBeCloseTo(0.86, 2);
  });
  it('in the town by day every infant out of doors is drawn with the one minding it, and nearly every mother of an infant out of doors carries a child', () => {
    const out: Record<string, unknown> = {}; let held = 0, unseen = 0, mothers = 0, carrying = 0, own = 0, hands = 0, jump = 0; const modes: Record<string, number> = {};
    for (const [d, h] of [[40, 9.5], [40, 16.5], [200, 10.5]] as [number, number][]) {
      const t = d * 24 + h; sim.jumpTo(t); view.settle(t, [-422, -941]); const K = view.kids; held += K.held; unseen += K.unseen; hands += K.hands; jump = Math.max(jump, K.handJumpMax);
      for (const [m, n] of Object.entries(K.byMode)) modes[m] = (modes[m] ?? 0) + n;
      const infantsOf = new Map<number, number[]>(); for (const p of sim.pop.persons) if (p.mother >= 0 && sim.pop.present(p.id, d) && sim.pop.ageOn(p.id, d) === 0) (infantsOf.get(p.mother) ?? infantsOf.set(p.mother, []).get(p.mother)!).push(p.id);
      for (const o of view.visible) { const kids = infantsOf.get(o.pid); if (!kids || o.agent >= 0) continue; mothers++; if (o.babes?.length) carrying++; if (o.babes?.some(b => kids.includes(b.pid))) own++; }
      out[`d${d}h${h}`] = { visible: view.visible.length, held: K.held, unseen: K.unseen, noCarer: K.noCarer, second: K.second, byMode: K.byMode, hands: K.hands, led: K.led };
      for (const o of view.visible) for (const b of o.babes ?? []) { expect(BABE_MODES).toContain(b.mode); expect(b.months).toBeGreaterThanOrEqual(0); expect(b.months).toBeLessThan(40); }
    }
    note('town', { ...out, held, unseen, share: held / Math.max(1, held + unseen), mothersOut: mothers, carrying, ownInfant: own, modes, hands, handJumpMax: jump });
    expect(held).toBeGreaterThan(20);
    expect(held / (held + unseen), 'infants out of doors drawn with their carer').toBeGreaterThan(0.9);
    expect(mothers).toBeGreaterThan(10); expect(carrying / mothers, 'mothers of infants out of doors who carry a child').toBeGreaterThan(0.8);
    expect(Object.keys(modes).length, 'more than one way of holding').toBeGreaterThanOrEqual(3);
    expect(jump, 'a child taken to its carer’s hand moves at most the snap distance and the walkers’ spacing').toBeLessThan(HAND_SNAP + handReach(1.44).gap + 0.01);
  }, 900_000);
  it('the child sits on the carer’s body: on the hip, in the arms or lap within reach of the holding hand, a sling behind or before the chest, a mat or cradle on the ground beside; never below the ground', () => {
    const crowd = crowdWith({ 1: { sex: 'f', age: 25 }, 2: { sex: 'f', age: 12 } }), c = cam(), res: Record<string, number[]> = {};
    const cases: [BabeMode, ActivityId, number, boolean][] = [['hip', 'walk', 8, true], ['hip', 'talk', 10, false], ['back', 'walk', 5, true], ['back', 'grind', 2, false], ['front', 'walk', 4, true],
      ['arms', 'walk', 1, true], ['nurse', 'rest', 3, false], ['lap', 'rest', 9, false], ['lap', 'eat', 7, false], ['mat', 'weave', 2, false], ['cradle', 'grind', 5, false], ['hip', 'walk', 20, true]];
    for (const pid of [1, 2]) for (const [mode, act, months, moving] of cases) {
      const p = crowd.attachPop(pid), key = `p${pid}`, v = vpOf(pid, act, '', { moving, speed: moving ? 1.2 : 0, babes: [{ pid: 99, months, mode }] });
      let worst = 0, handD = Infinity, lowY = Infinity, dPel = 0;
      for (let f = 0; f < 12; f++) { p.vp = v; p.vpFrame = (crowd as any).frame + 1; crowd.update(1 + f * 0.37, c.position, null, c);
        const B = p.babeProps![0]; expect(B.mode).toBe(mode); const M = B.M, o = new THREE.Vector3().setFromMatrixPosition(M), up = new THREE.Vector3().setFromMatrixColumn(M, 1);
        const L = babeLength(months), ctr = o.clone().add(up.clone().multiplyScalar(0.18 * L / 0.7)); lowY = Math.min(lowY, o.y);
        const pel = boneOf(crowd, key, HB.pelvis), ch = boneOf(crowd, key, HB.spine_03); dPel = Math.max(dPel, Math.min(ctr.distanceTo(pel), ctr.distanceTo(ch)));
        const H = mode === 'mat' || mode === 'cradle' ? null : HOLD[mode];
        if (H?.l) { const hl = boneOf(crowd, key, HB.hand_l).lerp(boneOf(crowd, key, HB.middle_01_l), 0.85); handD = Math.min(handD, hl.distanceTo(ctr)); worst = Math.max(worst, hl.distanceTo(ctr)); } }
      res[`${pid}:${mode}/${act}/${months}m`] = [+dPel.toFixed(3), +(isFinite(handD) ? worst : 0).toFixed(3), +lowY.toFixed(3)];
      expect(lowY, `${mode} ${act}: below the ground`).toBeGreaterThan(-0.03);
      if (mode === 'mat' || mode === 'cradle') expect(dPel, `${mode}: beside her on the ground`).toBeLessThan(1.1);
      else { expect(dPel, `${pid} ${mode} ${act}: on the body`).toBeLessThan(0.42); if (HOLD[mode].l) expect(worst, `${pid} ${mode} ${act}: the holding hand`).toBeLessThan(0.3); }
      expect(crowd.stats().props).toBeGreaterThan(0);
    }
    note('onBody', res);
    const union = propUnionGeometry(BABE_CLASS).getAttribute('position').count / 3; note('babeUnion', union);
    expect(union, 'the carried children’s union').toBeLessThanOrEqual(1000);
    for (const k of PROP_CLASSES[BABE_CLASS]) { expect(PROP_NOTES[k].tier).toBe('C'); expect(propSlot(k)![0]).toBe(BABE_CLASS); }
  }, 300_000);
  it('a small child walking with someone walks at their side hand in hand, and a child leads a blind elder: the palms meet (within 12 cm)', () => {
    const res: Record<string, number> = {};
    for (const [cAge, kAge] of [[30, 2], [30, 3], [70, 8]] as const) {
      const crowd = crowdWith({ 1: { sex: 'f', age: cAge }, 2: { sex: 'm', age: kAge } }), c = cam(), R = handReach(CHILD_H[kAge]);
      const a = crowd.attachPop(1), b = crowd.attachPop(2); let gap = 0;
      for (let f = 0; f < 10; f++) { const va = vpOf(1, 'walk', '', { moving: true, speed: 1.1, e: 0, n: 6, hand: 1, handSide: 'l', handWith: 2 }), vb = vpOf(2, 'walk', '', { moving: true, speed: 1.1, e: R.gap, n: 6, hand: 2, handSide: 'r', handWith: 1, handUp: R.raise });
        a.vp = va; b.vp = vb; a.vpFrame = b.vpFrame = (crowd as any).frame + 1; crowd.update(1 + f * 0.3, c.position, null, c);
        const w = (key: string, bone: number) => { const p = crowd.persons.get(key)!; return boneOf(crowd, key, bone).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.root[3]).add(new THREE.Vector3(p.root[0], p.root[1], p.root[2])); };
        const hl = w('p1', HB.hand_l).lerp(w('p1', HB.middle_01_l), 0.85), hr = w('p2', HB.hand_r).lerp(w('p2', HB.middle_01_r), 0.85); gap = Math.max(gap, hl.distanceTo(hr)); }
      res[`${cAge}/${kAge}`] = +gap.toFixed(3);
      expect(gap, `${cAge} with ${kAge}: the grown walker’s left palm and the child’s right palm`).toBeLessThan(0.12); }
    note('handGap', res);
  }, 120_000);
});

describe('children’s play (gap audit item 26)', () => {
  it('several kinds of play by age and sex: the toy bow for boys, the rattle for the smallest, no running game under three', () => {
    const count = (sex: 'm' | 'f', age: number) => { const c: Record<string, number> = {}; for (let s = 0; s < 3000; s++) { const P = performanceFor('play', 'playing in the lane', s, undefined, { sex, age }); const k = P.prop ?? P.anim; c[k] = (c[k] ?? 0) + 1; } return c; };
    const boy8 = count('m', 8), girl8 = count('f', 8), two = count('m', 2), six = count('f', 6);
    note('play', { boy8, girl8, two, six });
    expect(boy8.toy_bow / 3000).toBeGreaterThan(0.1); expect(girl8.toy_bow ?? 0).toBe(0); expect(two.ball ?? 0).toBe(0); expect(two.chase ?? 0).toBe(0);
    expect(two.rattle / 3000).toBeGreaterThan(0.05); expect(two.pull_toy / 3000).toBeGreaterThan(0.1);
    for (const c of [boy8, girl8, six]) expect(Object.keys(c).length).toBeGreaterThanOrEqual(4);
    expect(girl8.dice / 3000, 'knucklebones in the dust').toBeGreaterThan(0.12);
    // the extras (no performer given) take every kind by share, as before
    const any = new Set<string>(); for (let s = 0; s < 500; s++) any.add(performanceFor('play', '', s).anim); expect(any.size).toBeGreaterThanOrEqual(6);
    for (const k of ['knucklebones', 'toy_wheeled'] as const) expect(WORK_NOTES[k].note.length).toBeGreaterThan(30);
  });
  it('the running and toy-pulling paths are continuous and come round to the spot; the ball rises from between the hands', () => {
    for (const id of ['chase', 'pull_toy'] as const) { expect(WORK_META[id].path).toBe(true); let prev = playPath(id, 0, 0.3), mx = 0;
      for (let i = 1; i < 2000; i++) { const t = i * 0.02, p = playPath(id, t, 0.3); mx = Math.max(mx, Math.hypot(p[0] - prev[0], p[1] - prev[1])); prev = p; }
      expect(mx / 0.02, `${id}: speed`).toBeLessThan(PLAY_PATH[id].v * 1.05); const P = PLAY_PATH[id], T = 2 * Math.PI * P.r / P.v, a = playPath(id, 1, 0.3), b = playPath(id, 1 + T, 0.3); expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6); }
    const crowd = crowdWith({ 3: { sex: 'f', age: 7 } }), c = cam(), p = crowd.attachPop(3); let seen = 0, top = 0;
    const seed = [...Array(3000).keys()].find(s => performanceFor('play', 'x', s, undefined, { sex: 'f', age: 7 }).anim === 'ball')!;
    p.animK = seed / 159;
    for (let f = 0; f < 40; f++) { p.vp = vpOf(3, 'play', 'x'); p.vpFrame = (crowd as any).frame + 1; crowd.update(1 + f * 0.05, c.position, null, c);
      if (p.prop === 'ball') { seen++; const m = new THREE.Vector3().setFromMatrixPosition(p.propM), hl = boneOf(crowd, 'p3', HB.hand_l), hr = boneOf(crowd, 'p3', HB.hand_r), mid = hl.add(hr).multiplyScalar(0.5);
        expect(Math.hypot(m.x - mid.x, m.z - mid.z), 'the ball above the hands').toBeLessThan(0.15); top = Math.max(top, m.y - mid.y); } }
    expect(seen).toBeGreaterThan(30); expect(top, 'thrown up').toBeGreaterThan(0.5);
  }, 120_000);
  it('toys are left in the courtyards of about one house in four', () => {
    let houses = 0, toys = 0; for (const s of plan.sites) { const withToys = new Set(s.fittings.filter(f => f.kind === 'toys').map(f => f.plot));
      for (const p of s.plots) if (p.kind === 'house' || p.kind === 'house_large') { houses++; if (withToys.has(p.idx)) toys++; } }
    note('yards', { houses, toys, share: toys / houses });
    expect(houses).toBeGreaterThan(100); expect(toys / houses).toBeGreaterThan(TOYS_SHARE / 100 - 0.08); expect(toys / houses).toBeLessThan(TOYS_SHARE / 100 + 0.08);
  });
});

describe('ornaments by rank, the wicker shield, the gilded spear butts, eye paint (gap audit item 21)', () => {
  it('the shares by dress follow the table (JEWELS); working men and children wear none; kohl for the court', () => {
    const res: Record<string, Record<string, number>> = {};
    const roles: [Dress, string, 'm' | 'f'][] = [['persian', 'official', 'm'], ['guard', 'guard', 'm'], ['median', 'guard', 'm'], ['median', 'scribe', 'm'], ['woman', 'grinder', 'f'], ['worker', 'mason', 'm'], ['child', 'child', 'm'], ['king', 'king', 'm'], ['court_woman', 'musician', 'f']];
    for (const [dress, role, sex] of roles) { const c = { ear: 0, brace: 0, shield: 0, kohl: 0 }, N = 400;
      for (let s = 0; s < N; s++) { const L = lookFor(A, { id: s, sex, role, dress, seed: 20000 + s * 7 }, 1);
        if (L.pieces.some(x => x.startsWith('earrings'))) c.ear++; if (L.pieces.some(x => x.startsWith('bracelets'))) c.brace++; if (L.pieces.includes('shield')) c.shield++; if (unpackLookBits(L.pattern).kohl) c.kohl++;
        for (const id of COSTUMES[dress].opt) expect(((L.mask >> pieceBit(dress, id)) & 1) === 1, `${dress} ${id}`).toBe(L.pieces.includes(id));
        if (L.pieces.includes('shield')) { expect(L.pieces).toContain('bow'); expect(L.pieces).toContain('quiver'); } } // (Herodotus 7.61: wicker shields with the quivers and bows)
      res[`${dress}/${role}`] = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / N]));
      const J = JEWELS[dress], want = J ? (dress === 'median' && role === 'guard' ? J.guard! : J.base) : { ear: 0, brace: 0, shield: 0, kohl: 0 };
      expect(Math.abs(c.ear / N - want.ear), `${dress} earrings`).toBeLessThan(0.08); expect(Math.abs(c.brace / N - want.brace), `${dress} bracelets`).toBeLessThan(0.08);
      expect(Math.abs(c.shield / N - (want.shield ?? 0)), `${dress} shield`).toBeLessThan(0.08); expect(Math.abs(c.kohl / N - (want.kohl ?? 0)), `${dress} kohl`).toBeLessThan(0.08); }
    note('ranks', res);
    // looks that existed before D-215 are unchanged in everything else (the new draws come last)
    const L = lookFor(A, { id: 1, sex: 'm', role: 'mason', dress: 'worker', seed: 1234 }, 1); expect(unpackLookBits(L.pattern).kohl).toBe(0);
  });
  it('earrings hang from the ear lobes, bracelets round the wrists, the shield outside the body (bind pose, every variant)', () => {
    const at = (id: string, v: number) => { const g = O.geos![id], base = v * O.NV * 4 + O.pieceBase[id] * 4, pts: THREE.Vector3[] = []; for (let i = 0; i < g.n; i++) pts.push(new THREE.Vector3(O.source[base + i * 4], O.source[base + i * 4 + 1], O.source[base + i * 4 + 2])); return pts; };
    let worstLobe = 0, worstWrist = 0, minShield = Infinity;
    for (const V of A.variants) { if (V.meta.group === 'child') continue; const J = (b: string) => [V.joints[HB[b as keyof typeof HB] * 3], V.joints[HB[b as keyof typeof HB] * 3 + 1], V.joints[HB[b as keyof typeof HB] * 3 + 2]] as [number, number, number];
      const lobes = earLobes({ A, v: V, J: J as any }), ring = at('earrings@0', V.index);
      for (const l of lobes) { const d = Math.min(...ring.map(p => p.distanceTo(new THREE.Vector3(...l)))); worstLobe = Math.max(worstLobe, d); expect(l[1]).toBeLessThan(V.eyeY - 0.02); expect(l[1]).toBeGreaterThan(V.eyeY - 0.08); }
      const br = at('bracelets@0', V.index);
      for (const s of ['l', 'r'] as const) { const a = new THREE.Vector3(...J(`lowerarm_${s}`)), h = new THREE.Vector3(...J(`hand_${s}`)), c = a.clone().lerp(h, BRACELET_AT), ax = h.clone().sub(a).normalize();
        const mine = br.filter(p => Math.abs(p.clone().sub(c).dot(ax)) < 0.02 && p.distanceTo(c) < 0.09); expect(mine.length, `${V.meta.id} ${s} bracelet`).toBeGreaterThan(20);
        for (const p of mine) { const r = p.clone().sub(c), rad = r.sub(ax.clone().multiplyScalar(r.dot(ax))).length(); worstWrist = Math.max(worstWrist, rad); expect(rad).toBeGreaterThan(0.012); } }
      const hx = J('hand_l')[0]; for (const p of at('shield@0', V.index)) minShield = Math.min(minShield, p.x - hx); }
    note('pieces', { worstLobe, worstWrist, minShieldX: minShield });
    expect(worstLobe, 'the hoop passes by the lobe').toBeLessThan(0.006); expect(worstWrist, 'a bracelet close round the wrist').toBeLessThan(0.07); expect(minShield, 'the shield outside the left hand').toBeGreaterThan(0.01);
  });
  it('the king’s spearmen carry apples of gold at the butt; one Persian-dress guard in ten a golden pomegranate', () => {
    const people: Record<number, { sex: 'm'; age: number; dress: Dress }> = {}; for (let i = 1; i <= 60; i++) people[i] = { sex: 'm', age: 30, dress: 'guard' };
    const crowd = crowdWith(people), c = cam(); let apple = 0, gpom = 0, silver = 0;
    for (let i = 1; i <= 60; i++) { const p = crowd.attachPop(i); p.vp = vpOf(i, 'stand_guard', 'on watch', { e: (i % 10) - 5, n: 5 + Math.floor(i / 10), carryNote: i <= 20 ? 'spear with its apple-shaped butt, bow and quiver (reliefs B)' : null }); p.vpFrame = (crowd as any).frame + 1; }
    crowd.update(1, c.position, null, c);
    for (let i = 1; i <= 60; i++) { const k = crowd.persons.get(`p${i}`)!.prop; if (i <= 20) { expect(k).toBe('spear_apple'); apple++; } else if (k === 'spear_gpom') gpom++; else { expect(k).toBe('spear'); silver++; } }
    note('spears', { apple, gpom, silver }); expect(gpom).toBeGreaterThan(0); expect(gpom).toBeLessThan(12);
  }, 120_000);
  it('eye paint fills the lashes’ roots with a dark line (the material’s CPU mirror)', () => {
    const f = (kohl: number, tl: number): Frag => ({ color: [0.3, 0.2, 0.15], hair: [0.03, 0.02, 0.015], mat: [MAT.lash, 0, kohl * 2 ** 17, 0], bind: [0.03, 1.6, 0.1], aux: [1, 0, 0, 0.5], ext: [tl, 0], uv: [0.733, 0.9], posV: [0, 0, -1], nrmV: [0, 0, 1] });
    let keptPlain = 0, keptKohl = 0; const N = 40;
    for (let i = 0; i < N; i++) { const tl = 0.02 + 0.3 * i / N; if (surface(f(0, tl), 0.001, [0, 0, 1], 0, null).keep) keptPlain++; const s = surface(f(1, tl), 0.001, [0, 0, 1], 0, null); if (s.keep) keptKohl++; expect(Math.max(...s.alb)).toBeLessThan(0.03); }
    note('kohl', { keptPlain, keptKohl, of: N }); expect(keptKohl).toBe(N); expect(keptKohl).toBeGreaterThan(keptPlain);
  });
});

describe('the court women’s dress (gap audit item 22; BLOCKERS B20c)', () => {
  it('the many-folded robe, the crenellated crown and the long veil on the Persian mesh; gold at the ears and wrists; the eyes lined; no new mesh', () => {
    expect(COSTUME_OF.court_woman).toBe('persian'); expect(Object.keys(O.costumes)).not.toContain('court_woman');
    for (let s = 0; s < 30; s++) { const L = lookFor(A, { id: s, sex: 'f', role: 'musician', dress: 'court_woman', seed: 7000 + s }, 1);
      for (const id of ['robe_upper', 'robe_skirt', 'robe_sleeves', 'crown_w', 'veil', 'earrings', 'bracelets']) expect(L.pieces, id).toContain(id);
      expect(L.pieces.some(x => x.startsWith('beard'))).toBe(false); expect(unpackLookBits(L.pattern).kohl).toBe(1); expect(L.far).toBe('woman'); }
    // the veil hangs behind, clear of the robe: every veil vertex behind the body's front and outside the robe's back
    const V = A.byId.f02 ?? A.variants.find(v => v.meta.sex === 'f')!, base = V.index * O.NV * 4, veil = O.geos!['veil@0'], robe = O.geos!['robe_upper@0'];
    const pts = (g: typeof veil, id: string) => Array.from({ length: g.n }, (_, i) => { const o = base + (O.pieceBase[id] + i) * 4; return new THREE.Vector3(O.source[o], O.source[o + 1], O.source[o + 2]); });
    const vp = pts(veil, 'veil@0'), rp = pts(robe, 'robe_upper@0'); let inside = 0;
    for (const p of vp) { const near = rp.filter(q => Math.abs(q.y - p.y) < 0.02 && q.z < 0 && Math.abs(q.x - p.x) < 0.03); if (near.length && p.z > Math.min(...near.map(q => q.z)) + 0.004) inside++; }
    note('veil', { vertices: vp.length, insideRobe: inside }); expect(inside / vp.length, 'the veil inside the robe').toBeLessThan(0.03);
  });
});

describe('the lame and the blind (gap audit item 37, sparingly)', () => {
  it('a few lame men of working age and blind elders; none among the guards; they walk with a staff', () => {
    const d = 40; let men = 0, lame = 0, old = 0, blind = 0, guards = 0;
    for (const p of sim.pop.persons) { const a = sim.pop.ageOn(p.id, d), k = view.impairOf(p.id, d);
      if (p.job === 'guard') { if (k) guards++; continue; }
      if (p.sex === 'm' && a >= 22 && a <= 60 && p.agent < 0) { men++; if (k === 1) lame++; } if (a >= 60 && p.agent < 0) { old++; if (k === 2) blind++; } }
    note('impair', { men, lame, lameShare: lame / men, old, blind, blindShare: blind / old });
    expect(guards).toBe(0); expect(lame / men).toBeGreaterThan(IMPAIR.lame.share * 0.5); expect(lame / men).toBeLessThan(IMPAIR.lame.share * 1.6);
    expect(blind / old).toBeGreaterThan(IMPAIR.blind.share * 0.5); expect(blind / old).toBeLessThan(IMPAIR.blind.share * 1.6);
    const crowd = crowdWith({ 5: { sex: 'm', age: 40 }, 6: { sex: 'm', age: 70 } }), c = cam();
    for (let f = 0; f < 3; f++) { for (const [pid, k] of [[5, 1], [6, 2]] as const) { const p = crowd.attachPop(pid); p.vp = vpOf(pid, 'walk', 'walking home', { moving: true, speed: 1, impair: k, e: pid - 5.5 }); p.vpFrame = (crowd as any).frame + 1; } crowd.update(1 + f * 0.2, c.position, null, c); }
    expect(crowd.persons.get('p5')!.anim).toBe('limp'); expect(crowd.persons.get('p6')!.anim).toBe('feel');
    expect(crowd.persons.get('p5')!.prop).toBe('staff'); expect(crowd.persons.get('p6')!.prop).toBe('staff');
    expect(ACTIVITIES.walk.anim).toBe('walk'); // (the walk itself is unchanged for everyone else)
  }, 120_000);
});
void monthsOld;
