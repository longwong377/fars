// The pieces a person wears are the pieces drawn (D-205). Report: the camera-rig moment `scribe-at-work` rendered the
// scribe "bare-chested, bald and barefoot, in a short skirt and a red belt". Measured here in node, through the same data
// the GPU draws (the costume's index and vertex piece bits, the person row's mask, the skin palette the crowd poses, the
// material's hide test mirrored in float32): (1) the moment itself, as a CPU id raster from the moment's camera; (2) the
// class: every dress × LOD × a sample of looks × plain, cold and laid-aside masks; (3) the performers in their work poses
// (scribes, masons, grinders, bakers, porters) through the Crowd's own pose path. Numbers: bench-reports/people-pieces.json.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { buildOutfits, BUILT, COSTUMES, COSTUME_OF, DRESSES, pieceBit, weatherMask, type Dress, type OutfitBuild, type CostumeLOD } from '../src/people/outfits';
import { lookFor, DELEGATIONS, type PersonLook } from '../src/people/looks';
import { PART } from '../src/people/humanFormat';
import { PERSON_TEXELS } from '../src/people/humanMaterial';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd, type Person } from '../src/people/crowd';
import { skinPoint, PALETTE_STRIDE } from '../src/people/humanRig';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan } from '../src/world/settlement/plan';
import { PopGeo } from '../src/people/popgeo';
import { PopView } from '../src/people/popview';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from './plainLib';
import type { ActivityId } from '../src/people/activities';

let A: HumanAssets, O: OutfitBuild;
const OUT: Record<string, unknown> = {};
const save = () => { mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/people-pieces.json', JSON.stringify(OUT, null, 1)); };
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
}, 300_000);

/** the material's hide test (humanMaterial positionNode: shown = mod(floor(mask / exp2(bit)), 2)), in float32 */
const shownBit = (mask: number, bit: number) => Math.floor(Math.fround(Math.fround(mask) / Math.fround(2 ** bit))) % 2 === 1;
/** the piece each vertex of a costume LOD belongs to ('body' for the body's own vertices), from the vertex source layout */
const pieceCache = new Map<CostumeLOD, string[]>();
function piecesOf(C: CostumeLOD): string[] {
  let r = pieceCache.get(C); if (r) return r;
  const ranges = Object.entries(O.pieceBase).map(([k, base]) => [k.split('@')[0], base, base + O.geos![k].n] as const);
  r = Array.from(C.tid, t => (t < A.NO ? 'body' : ranges.find(([, a, b]) => t >= a && t < b)![0])); pieceCache.set(C, r); return r;
}
/** the pieces with at least one triangle kept by the hide test for this mask */
function drawnPieces(C: CostumeLOD, mask: number): Set<string> {
  const pc = piecesOf(C), s = new Set<string>();
  for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t]; if (pc[a] !== 'body' && shownBit(mask, C.hmat[a * 4 + 2])) s.add(pc[a]); }
  return s;
}
/** laid aside while seated or crouched, and the headgear while asleep (crowd.ts asideBits) */
const ASIDE = ['kandys', 'quiver', 'bow', 'gorytos', 'akinaka'], ASIDE_SLEEP = ['hat_fluted', 'fillet', 'cap_soft', 'headband', 'cap_pointed', 'cap_low', 'crown'];
/** the dress of the cold (outfits.coldBits: brief §9.2), as piece ids */
const COLD_ON: Partial<Record<Dress, string[]>> = { median: ['kandys'], worker: ['work_trousers', 'cap_soft'], woman: ['headcloth'], child: ['shoes'] }, COLD_OFF: Partial<Record<Dress, string[]>> = { woman: ['hair', 'hair_bob'] };
const bitsOf = (dress: Dress, ids: Iterable<string>) => { let m = 0; for (const id of ids) { const b = pieceBit(dress, id); if (b) m |= 1 << b; } return m; };

// ------------------------------------------------------------------------------------------------ CPU id raster
interface Hit { counts: Map<string, number>; bodyParts: Map<number, number> }
/** rasterise drawn people as the GPU places them (source row of the person's variant, the posed palette, the root, the
 *  person row's mask and scale) into an id buffer; counts visible pixels per piece and per body part */
function raster(people: { C: CostumeLOD; slot: number; root: ArrayLike<number> }[], gpu: HumanGPU, cam: THREE.Camera, W = 480, H = 270): Hit {
  const zb = new Float32Array(W * H).fill(Infinity), id = new Int32Array(W * H).fill(-1), names: string[] = [];
  cam.updateMatrixWorld(); const VP = new THREE.Matrix4().multiplyMatrices((cam as THREE.PerspectiveCamera).projectionMatrix, cam.matrixWorldInverse), v4 = new THREE.Vector4(), o = [0, 0, 0];
  for (const { C, slot, root } of people) {
    const row = slot * PERSON_TEXELS * 4, variant = gpu.person[row], mask = gpu.person[row + 1], sc = gpu.person[row + 29], pc = piecesOf(C);
    const n = C.tid.length, scr = new Float32Array(n * 3), c = Math.cos(root[3]), s = Math.sin(root[3]);
    for (let k = 0; k < n; k++) { const t = (variant * O.NV + C.tid[k]) * 4;
      skinPoint(gpu.palette, slot * PALETTE_STRIDE, C.skinIndex.subarray(k * 4, k * 4 + 4), Array.from(C.skinWeight.subarray(k * 4, k * 4 + 4), x => x / 255), O.source.subarray(t, t + 3), o);
      v4.set((c * o[0] + s * o[2]) * sc + root[0], o[1] * sc + root[1], (-s * o[0] + c * o[2]) * sc + root[2], 1).applyMatrix4(VP);
      scr[k * 3] = (v4.x / v4.w * 0.5 + 0.5) * W; scr[k * 3 + 1] = (0.5 - v4.y / v4.w * 0.5) * H; scr[k * 3 + 2] = v4.w; }
    const tag = new Map<string, number>();
    for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t], b = C.index[t + 1], d = C.index[t + 2];
      if (!shownBit(mask, C.hmat[a * 4 + 2]) || scr[a * 3 + 2] < 0.05 || scr[b * 3 + 2] < 0.05 || scr[d * 3 + 2] < 0.05) continue;
      const nm = pc[a] === 'body' ? `body:${A.part[C.tid[a]]}` : pc[a]; let q = tag.get(nm); if (q === undefined) { q = names.length; names.push(nm); tag.set(nm, q); }
      const x0 = scr[a * 3], y0 = scr[a * 3 + 1], x1 = scr[b * 3], y1 = scr[b * 3 + 1], x2 = scr[d * 3], y2 = scr[d * 3 + 1], ar = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(ar) < 1e-12) continue;
      for (let py = Math.max(0, Math.floor(Math.min(y0, y1, y2))); py <= Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2))); py++)
        for (let px = Math.max(0, Math.floor(Math.min(x0, x1, x2))); px <= Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2))); px++) { const qx = px + 0.5, qy = py + 0.5;
          const w0 = ((x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy)) / ar, w1 = ((x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy)) / ar, w2 = 1 - w0 - w1; if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * scr[a * 3 + 2] + w1 * scr[b * 3 + 2] + w2 * scr[d * 3 + 2], i = py * W + px; if (z < zb[i]) { zb[i] = z; id[i] = q; } } }
  }
  const counts = new Map<string, number>(), bodyParts = new Map<number, number>();
  for (const q of id) { if (q < 0) continue; const nm = names[q]; counts.set(nm, (counts.get(nm) ?? 0) + 1); if (nm.startsWith('body:')) { const p = +nm.slice(5); bodyParts.set(p, (bodyParts.get(p) ?? 0) + 1); } }
  return { counts, bodyParts };
}
const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const newHumans = () => ({ A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64, castShadow: false }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } });
/** body parts under the upper garment of every built costume but the bare wrap (torso, upper arms): a body pixel of these
 *  is skin where the look wears cloth (the neckline's edge on the chest shows a little). Thighs are not counted: a knee-length
 *  skirt shows them when its wearer squats or strides, as it would */
const CLOTHED_PARTS = new Set<number>([PART.chest, PART.belly, PART.pelvis, PART.uarm_l, PART.uarm_r]);
/** the working and the child's tunic have short sleeves (outfits.ts armCut 0.22): their upper arms are bare */
const clothedParts = (costume: Dress) => (costume === 'worker' || costume === 'child' ? new Set([...CLOTHED_PARTS].filter(p => p !== PART.uarm_l && p !== PART.uarm_r)) : CLOTHED_PARTS);
const upperOf = (costume: Dress) => [...COSTUMES[costume].always].find(id => /upper/.test(id));

// (D-221: the moment moved to day 21, 13:30, from the room's W part: on day 25 at 10:00 one scribe was ill and the other in
// the store since D-211's turns by seat, so no scribe was in the room and this test failed on the base tree)
describe('the scribe-at-work moment (tests/e2e/moments.spec.ts: day 21, 13:30, (184.1, −82.9, 1.05), az 76°, pitch −10°, fov 50)', () => {
  it('both scribes write at the desk in Median dress at full detail, and their tunics, trousers and boots fill the frame where the render showed skin', () => {
    const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const sim = new PeopleSim(1, nav, env), plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1);
    const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
    const view = new PopView(sim, geo, 1); sim.jumpTo(21 * 24 + 13.5); for (let i = 0; i < 20; i++) sim.step(3);
    const humans = newHumans(), crowd = new Crowd(sim, 1, humans as any); crowd.view = view; crowd.looksPerFrame = 1e9;
    // main.ts __parsa.view: the eye above the ground, the azimuth true (grid north is 341° true: yaw = −(az − 341°))
    const e = 184.1, n = -82.9, y = nav.heightAt(e, n) + 1.05, cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 5000); cam.position.set(e, y, -n);
    const h = ((76 - 341) * Math.PI) / 180, p = (-10 * Math.PI) / 180; cam.lookAt(e + Math.sin(h) * Math.cos(p) * 10, y + Math.sin(p) * 10, -n - Math.cos(h) * Math.cos(p) * 10);
    for (let f = 0; f < 3; f++) { view.update(sim.t, [e, n]); crowd.update(f * 0.1, cam.position, null, cam); }
    const near = [...crowd.persons.values()].filter(q => q.drawnFrame > 0 && q.dist < 6);
    const scribes = near.filter(q => q.agent?.role === 'scribe'), s = scribes[0];
    expect(scribes.length, 'both scribes drawn within 6 m').toBe(2); expect(scribes.every(q => q.anim === 'write')).toBe(true);
    const row = s.slot * PERSON_TEXELS * 4, mask = humans.gpu.person[row + 1];
    OUT.moment = { who: `agent ${s.agent!.id} (${s.agent!.role}, ${s.agent!.origin}; population ${s.pid})`, dist: +s.dist.toFixed(2), lod: s.lod, dress: s.look.dress, costume: COSTUME_OF[s.look.dress], variant: s.look.variantId, anim: s.anim, act: s.act,
      lookPieces: s.look.pieces, lookMask: s.look.mask, drawnMask: mask };
    expect(s.look.dress).toBe('median'); expect(COSTUME_OF[s.look.dress]).toBe('median'); expect(s.lod).toBe(0); expect(s.anim).toBe('write');
    // the mask in the person row: the look's, the kandys laid aside while he sits (crowd.ts ASIDE)
    expect(mask).toBe(s.look.mask & ~(1 << pieceBit('median', 'kandys')));
    const C = O.costumes.median.find(c => c.lod === s.lod)!, drawn = drawnPieces(C, mask);
    for (const id of ['tunic_upper', 'tunic_skirt', 'trousers', 'belt', 'boots']) expect(drawn.has(id), id).toBe(true);
    const hit = raster(scribes.map(q => ({ C: O.costumes[COSTUME_OF[q.look.dress]].find(c => c.lod === q.lod)!, slot: q.slot, root: q.root })), humans.gpu, cam, 960, 540);
    const px = Object.fromEntries([...hit.counts].sort((a, b) => b[1] - a[1]));
    OUT.moment = { ...(OUT.moment as object), pixels960x540: px }; save();
    // what the render read as bare torso and arms, bald head, bare feet: the tunic, the felt cap, the boots
    // (the old view's thresholds kept: the two scribes at 2.7-3.8 m give tunic 12,690, trousers 2,859, cap 2,693, boots 2,404 px)
    expect(hit.counts.get('tunic_upper') ?? 0).toBeGreaterThan(5000);
    expect(hit.counts.get('cap_soft') ?? 0).toBeGreaterThan(1500);
    expect(hit.counts.get('boots') ?? 0).toBeGreaterThan(1500);
    expect(hit.counts.get('trousers') ?? 0).toBeGreaterThan(1500);
    // no skin of the torso or upper arms: under 1 % of the tunic's pixels (the neckline's edge)
    const bare = [...hit.bodyParts].filter(([pt]) => CLOTHED_PARTS.has(pt)).reduce((a, [, c]) => a + c, 0);
    expect(bare, 'skin pixels of the torso, upper arms and thighs').toBeLessThan(0.01 * hit.counts.get('tunic_upper')!);
  }, 300_000);
});

describe('the class: every dress × LOD × look × mask draws exactly the pieces the look wears (D-205)', () => {
  it('each piece is hidden or shown whole; its vertices carry its own bit; every piece has triangles at every LOD', () => {
    let verts = 0;
    for (const d of BUILT) for (const C of O.costumes[d]) { const pc = piecesOf(C);
      for (let k = 0; k < C.tid.length; k++) { const want = pc[k] === 'body' ? 0 : pieceBit(d, pc[k]); expect(C.hmat[k * 4 + 2], `${d}@${C.lod} ${pc[k]}`).toBe(want); verts++; }
      for (let t = 0; t < C.index.length; t += 3) { const a = C.index[t]; expect(C.hmat[C.index[t + 1] * 4 + 2]).toBe(C.hmat[a * 4 + 2]); expect(C.hmat[C.index[t + 2] * 4 + 2]).toBe(C.hmat[a * 4 + 2]); }
      const have = new Set<string>(); for (let t = 0; t < C.index.length; t += 3) have.add(pc[C.index[t]]);
      for (const id of [...COSTUMES[d].always, ...COSTUMES[d].opt]) expect(have.has(id), `${d}@${C.lod}: ${id} has triangles`).toBe(true); }
    OUT.vertexBits = { costumes: BUILT.length, lods: O.costumes.median.length, vertices: verts }; save();
  });
  it('for every dress, LOD and a sample of looks: the pieces drawn (the hide test on the costume) are the pieces worn — plain, in the cold, seated and asleep', () => {
    const roles: Record<string, string[]> = { persian: ['official'], guard: ['guard'], king: ['king'], median: ['scribe', 'guard', 'courier', 'foreman'], worker: ['mason', 'porter'], woman: ['grinder', 'baker'], child: ['child'] };
    const looks: { look: PersonLook; why: string }[] = [];
    for (const d of DRESSES) for (const role of roles[d] ?? ['envoy']) for (let s = 0; s < 24; s++) { if (d.startsWith('envoy')) continue;
      looks.push({ look: lookFor(A, { id: s, sex: d === 'woman' ? 'f' : s % 7 === 3 && d === 'child' ? 'f' : 'm', role, dress: d, origin: s % 3 ? 'Persian' : 'Egyptian', seed: 9000 + s * 131 + d.length }, 1), why: `${d}/${role}/${s}` }); }
    for (const del of DELEGATIONS) for (let s = 0; s < 4; s++) looks.push({ look: lookFor(A, { id: s, sex: 'm', role: 'envoy', dress: del.dress, delegation: del.id, seed: 7000 + s }, 1), why: `delegation ${del.id}/${s}` });
    let combos = 0; const bad: string[] = [], dresses = new Set<string>();
    for (const { look, why } of looks) { const d = look.dress, costume = COSTUME_OF[d]; dresses.add(d);
      const worn = new Set(look.pieces);
      const cold = new Set([...worn, ...(COLD_ON[d] ?? []).filter(id => COSTUMES[d].opt.includes(id))]); for (const id of COLD_OFF[d] ?? []) cold.delete(id);
      const cases: [string, number, Set<string>][] = [['plain', look.mask, worn], ['cold', weatherMask(d, look.mask, 0), cold]];
      for (const [nm, ids] of [['seated', ASIDE], ['asleep', [...ASIDE, ...ASIDE_SLEEP]]] as const) { const off = bitsOf(d, ids.filter(id => COSTUMES[costume].opt.includes(id)));
        cases.push([nm, look.mask & ~off, new Set([...worn].filter(id => !(ids as readonly string[]).includes(id) || !COSTUMES[costume].opt.includes(id)))]); }
      for (const C of O.costumes[costume]) for (const [nm, mask, want] of cases) { combos++;
        const got = drawnPieces(C, mask), miss = [...want].filter(id => !got.has(id)), extra = [...got].filter(id => !want.has(id));
        if (miss.length || extra.length) bad.push(`${why} ${costume}@${C.lod} ${nm}: missing [${miss}] extra [${extra}]`); } }
    OUT.sweep = { looks: looks.length, dresses: [...dresses], combos, mismatches: bad.length, first: bad.slice(0, 10) }; save();
    expect(dresses.size).toBe(DRESSES.length); expect(combos).toBeGreaterThan(2000);
    expect(bad).toEqual([]);
  });
});

describe('performers in their work poses (the Crowd\'s pose, aside and mask path) show their garments, not their skin', () => {
  it('scribes, masons, grinders, bakers, porters and guards at every LOD: every garment worn is seen, no torso or sleeved-arm skin under a garment (≤ 3 % of the upper garment’s pixels; ≤ 6 % on the far bodies, LOD 2–3)', () => {
    const cases: { act: ActivityId; dress: Dress; role: string; sex: 'm' | 'f' }[] = [
      { act: 'write_tablet', dress: 'median', role: 'scribe', sex: 'm' }, { act: 'dress_stone', dress: 'worker', role: 'mason', sex: 'm' },
      { act: 'grind', dress: 'woman', role: 'grinder', sex: 'f' }, { act: 'knead', dress: 'woman', role: 'baker', sex: 'f' }, { act: 'bake', dress: 'woman', role: 'baker', sex: 'f' },
      { act: 'carry_sack', dress: 'worker', role: 'porter', sex: 'm' }, { act: 'stand_guard', dress: 'guard', role: 'guard', sex: 'm' }, { act: 'stand_guard', dress: 'median', role: 'guard', sex: 'm' }];
    const humans = newHumans(), crowd = new Crowd(null, 1, humans as any), rows: Record<string, unknown>[] = [], bad: string[] = [];
    const persons: { p: Person; c: typeof cases[number]; seed: number }[] = []; let worst = 0;
    cases.forEach((c, i) => { for (let s = 0; s < 4; s++) { const seed = 500 + i * 37 + s * 11;
      persons.push({ p: crowd.addExtra(`x${i}_${s}`, { id: -1 - i * 10 - s, sex: c.sex, role: c.role, dress: c.dress, seed, x: i * 40, y: 0, z: s * 40, yaw: 0.4 * s, act: c.act }), c, seed }); } });
    const eye = new THREE.Vector3(0, 1.6, -3); crowd.update(3.7, eye, null); crowd.update(3.8, eye, null);
    for (const { p, c, seed } of persons) {
      const row = p.slot * PERSON_TEXELS * 4, mask = humans.gpu.person[row + 1], costume = COSTUME_OF[p.look.dress];
      // posed now? (the crowd poses everyone shown; the extras stand 0-300 m from the eye: pose them all at full rate)
      expect(p.poseFrame, `${c.act} ${seed} posed`).toBeGreaterThan(0);
      for (const C of O.costumes[costume]) {
        const drawn = drawnPieces(C, mask), seen = new Set<string>(), body = new Map<number, number>(), upPx = new Map<string, number>();
        for (let v = 0; v < 6; v++) { const az = (v / 6) * Math.PI * 2, cam = new THREE.PerspectiveCamera(40, 1, 0.05, 50), r = p.root;
          cam.position.set(r[0] + Math.sin(az) * 3.2, r[1] + (v % 2 ? 2.2 : 1.0), r[2] + Math.cos(az) * 3.2); cam.lookAt(r[0], r[1] + 0.7, r[2]); cam.updateProjectionMatrix();
          const hit = raster([{ C, slot: p.slot, root: p.root }], humans.gpu, cam, 200, 200);
          for (const [k, n] of hit.counts) if (!k.startsWith('body:') && n > 0) { seen.add(k); upPx.set(k, (upPx.get(k) ?? 0) + n); } for (const [pt, n] of hit.bodyParts) body.set(pt, (body.get(pt) ?? 0) + n); }
        // garments that cover a body region (the upper garment, the skirt, trousers, footwear, headgear) are seen; small
        // pieces may hide behind others (a beard under a headcloth, a torque under a beard)
        const big = [...drawn].filter(id => /upper|skirt|trousers|boots|shoes|cap|hat|headcloth|robe|kandys|hair/.test(id));
        const headgear = [...drawn].some(id => /cap|hat|headcloth|crown/.test(id)), unseen = big.filter(id => !seen.has(id) && !(id === 'hair' && headgear)); // hair under a cap
        // skin where the look wears cloth: the torso, upper arms and thighs, against the upper garment's own pixels
        const cp = clothedParts(costume), skin = [...body].filter(([pt]) => cp.has(pt)).reduce((a, [, n]) => a + n, 0), all = [...body].reduce((a, [, n]) => a + n, 0), up = upPx.get(upperOf(costume)!) ?? 0;
        rows.push({ parts: Object.fromEntries(body), act: c.act, dress: c.dress, seed, lod: C.lod, anim: p.anim, mask, drawn: [...drawn].length, seen: [...seen].length, unseen, clothedSkinPx: skin, upperPx: up, bodyPx: all });
        worst = Math.max(worst, skin / Math.max(1, up));
        if (unseen.length) bad.push(`${c.act}/${c.dress} seed ${seed} LOD${C.lod}: not seen [${unseen}]`);
        if (skin > (C.lod >= 2 ? 0.06 : 0.03) * up) bad.push(`${c.act}/${c.dress} seed ${seed} LOD${C.lod}: ${skin} px of skin under the cloth against ${up} px of ${upperOf(costume)}`);
      } }
    OUT.performers = { people: persons.length, rows: rows.length, worstSkinShare: +worst.toFixed(4), problems: bad, sample: rows.filter((_, i) => i % 4 === 0) }; save();
    expect(rows.length).toBe(persons.length * 4);
    expect(bad).toEqual([]);
  }, 300_000);
});
