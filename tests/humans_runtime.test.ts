// Human runtime (D-090…D-093): loader, rig retarget, fitted costumes, looks, crowd pooling and the per-frame CPU budget.
// Measured, not eyeballed (screenshots: tests/e2e/humanlab.spec.ts, tests/e2e/humans.spec.ts).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { HB, HBONES, PART, MAT } from '../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, RETARGET, PLANTED, skinPoint, type RigInput } from '../src/people/humanRig';
import { ANIMS, POSE_BONES, pose } from '../src/people/anim';
import { buildOutfits, DRESSES, BUILT, COSTUME_OF, COSTUMES, PIECES, pieceBit, unpackNormal, packNormal, type OutfitBuild } from '../src/people/outfits';
import { lookFor, STATURE, TEXTILE } from '../src/people/looks';
import { HumanGPU, shadowsSeePeople, cascadeNeedsPeople, SHADOW_LAYER } from '../src/people/humanGPU';
import { Crowd, ATTACH_R, DETACH_R, MAX_FULL } from '../src/people/crowd';
import { ACTIVITIES } from '../src/people/activities';
import { propGeometry, PROPS } from '../src/people/props';

let A: HumanAssets, O: OutfitBuild;
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
  console.log(`outfits built in ${O.ms.toFixed(0)} ms (node): NV ${O.NV}, source ${(O.source.byteLength / 1e6).toFixed(1)} MB`);
}, 60_000);
const face = () => ({ jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 });
const input = (v: HumanAssets['variants'][number], po = { rot: {}, hips: [0, 0, 0] as [number, number, number] }): RigInput => ({ joints: v.joints, pose: po, face: face(), grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1 });

describe('loader', () => {
  it('decodes every variant with unit normals and the recorded heights', () => {
    expect(A.variants.length).toBe(23);
    for (const v of A.variants) {
      let top = -1; for (let i = 0; i < A.NO; i++) if (A.part[i] < PART.eye) top = Math.max(top, v.pos[i * 3 + 1]);
      expect(Math.abs(top - v.height)).toBeLessThan(0.002);
      for (let i = 0; i < A.NO; i += 97) expect(Math.abs(Math.hypot(v.nrm[i * 3], v.nrm[i * 3 + 1], v.nrm[i * 3 + 2]) - 1)).toBeLessThan(1e-4);
    }
  });
  it('packs normals to 24 bits with < 0.1° error', () => {
    let worst = 0; for (let i = 0; i < 2000; i++) { const t = Math.acos(2 * ((i * 0.618) % 1) - 1), p = i * 2.399; const n: [number, number, number] = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
      const q = unpackNormal(packNormal(...n)); worst = Math.max(worst, Math.acos(Math.min(1, n[0] * q[0] + n[1] * q[1] + n[2] * q[2]))); }
    expect((worst * 180) / Math.PI).toBeLessThan(0.1);
  });
});

describe('rig retarget (59 bones)', () => {
  it('maps every pose channel onto existing bones; the bind pose gives identity skin matrices', () => {
    for (const c of POSE_BONES) for (const [b] of RETARGET[c]) expect(HBONES).toContain(b);
    const v = A.byId.m03, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), inp = input(v);
    rig.setPose(inp); inp.grip = [0, 0];
    // relaxed finger curl is applied even at rest: check the non-finger bones only
    rig.solve(inp, pal, 0);
    for (const b of ['pelvis', 'spine_03', 'head', 'jaw', 'upperarm_l', 'thigh_r', 'foot_l'] as const) { const o = HB[b] * 12;
      expect([pal[o], pal[o + 5], pal[o + 10]].map(x => +x.toFixed(5))).toEqual([1, 1, 1]); expect(Math.abs(pal[o + 3]) + Math.abs(pal[o + 7]) + Math.abs(pal[o + 11])).toBeLessThan(1e-5); }
  });
  it('every animation poses the skeleton with finite matrices, feet on or above the ground when standing', () => {
    const v = A.byId.m08, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    for (const an of ANIMS) for (const t of [0.3, 1.7]) {
      const inp = input(v, pose(an, t, t * 5, 0.2)); inp.plant = PLANTED.has(an); rig.setPose(inp); rig.solve(inp, pal, 0);
      for (const x of pal) expect(Number.isFinite(x)).toBe(true);
      if (['idle', 'walk', 'guard', 'talk', 'inspect', 'carry_shoulder', 'guard_walk'].includes(an)) {
        let minY = 9; const o = [0, 0, 0];
        for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.foot_l && A.part[i] !== PART.foot_r) continue; const w = Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255); skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), w, v.pos.subarray(i * 3, i * 3 + 3), o); minY = Math.min(minY, o[1]); }
        expect(minY, `${an} lowest foot point`).toBeGreaterThan(-0.02); expect(minY, `${an} lowest foot point`).toBeLessThan(0.02); // planted: the sole on the ground (±2 cm: contact points approximate)
      }
    }
  });
  it('seated, kneeling and lying poses rest on the ground (the lowest body point within 3 cm of it)', () => {
    const v = A.byId.m08, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE); const o = [0, 0, 0];
    for (const an of ['sit', 'write', 'eat', 'dice', 'sleep', 'grind', 'knead', 'bake'] as const) for (const t of [0.4, 2.1]) {
      const inp = input(v, pose(an, t, t * 5, 0.2)); inp.seat = true; rig.setPose(inp); rig.solve(inp, pal, 0);
      let minY = 9; for (let i = 0; i < A.NO; i += 3) { if (A.part[i] >= PART.eye) continue; skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o); minY = Math.min(minY, o[1]); }
      expect(minY, `${an} lowest body point`).toBeGreaterThan(-0.03); expect(minY, `${an} lowest body point`).toBeLessThan(0.03);
    }
  });
  it('face: the jaw opens the mouth, a blink closes the upper lid, eyes turn toward a target', () => {
    const v = A.byId.m03, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    const chin = (() => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === A.meta.landmarks.chin) return i; return 0; })();
    const at = (inp: RigInput, i: number) => { rig.setPose(inp); rig.solve(inp, pal, 0); return skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3)); };
    const closed = at(input(v), chin)[1], open = (() => { const inp = input(v); inp.face.jaw = 0.2; return at(inp, chin)[1]; })();
    expect(closed - open).toBeGreaterThan(0.006); // chin drops ≥ 6 mm at 0.2 rad
    // upper-lid vertex (most lid_ul-weighted) moves down by ≥ 4 mm when the eye closes
    let lid = 0, best = 0; for (let i = 0; i < A.NO; i++) for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.lid_ul && A.skinWeight[i * 4 + k] > best) { best = A.skinWeight[i * 4 + k]; lid = i; }
    const lidOpen = at(input(v), lid)[1]; const inpB = input(v); inpB.face.blink = 1; const lidShut = at(inpB, lid)[1];
    expect(lidOpen - lidShut).toBeGreaterThan(0.004);
    // eyes: the gaze follows a target 1 m to the person's left
    const inpL = input(v); inpL.face.look = [1, v.eyeY, 1]; rig.setPose(inpL); rig.solve(inpL, pal, 0);
    const R = rig.wr, o = HB.eye_l * 9; const gaze = [R[o + 2], R[o + 5], R[o + 8]]; // +Z axis of the eye bone
    expect(gaze[0]).toBeGreaterThan(0.3);
  });
});

describe('skin texture (re-baked, D-090)', () => {
  it('paints the lips at the lips’ parting (head/jaw weight split), not on the chin', async () => {
    const { decodePNG } = await import('../tools/humans/png');
    const img = decodePNG(readFileSync('public/generated/humans/skin.png')); const v = A.byId.m03;
    let upLow = 9, loHigh = -9; // the parting from the weights (as the bake does)
    for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head || Math.abs(v.pos[i * 3]) > 0.0025 || v.pos[i * 3 + 2] < 0.14 || v.pos[i * 3 + 1] > v.eyeY - 0.05 || v.pos[i * 3 + 1] < v.eyeY - 0.13) continue;
      let w = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) w = A.skinWeight[i * 4 + k] / 255; if (w < 0.3) upLow = Math.min(upLow, v.pos[i * 3 + 1]); else if (w > 0.5) loHigh = Math.max(loHigh, v.pos[i * 3 + 1]); }
    const mouth = (upLow + loHigh) / 2;
    const redness = (y: number) => { let best = -1, dBest = 9; for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head || Math.abs(v.pos[i * 3]) > 0.004 || v.pos[i * 3 + 2] < 0.13) continue; const d = Math.abs(v.pos[i * 3 + 1] - y); if (d < dBest) { dBest = d; best = i; } }
      const hw = img.width / 2, x = Math.min(hw - 1, Math.floor(A.uv[best * 2] * hw)), yy = Math.min(img.height - 1, Math.floor((1 - A.uv[best * 2 + 1]) * img.height)), k = (yy * img.width + x) * 4; return img.data[k] / Math.max(1, img.data[k + 1]); }; // the albedo half of the 2:1 atlas (D-155)
    const lipUp = redness(mouth + 0.004), lipLo = redness(mouth - 0.005), chin = redness(mouth - 0.028), cheek = redness(mouth + 0.03);
    expect(lipUp).toBeGreaterThan(chin * 1.08); expect(lipLo).toBeGreaterThan(chin * 1.08); expect(lipUp).toBeGreaterThan(cheek * 1.05);
  });
});

describe('costumes (fitted to every variant)', () => {
  it('every dress builds at three LODs within triangle budgets; every piece is tiered with a source', () => {
    const budget = [42000, 7000, 3200, 800];
    expect(Object.keys(O.costumes).sort()).toEqual([...BUILT].sort()); // guards share the Persian costume's meshes
    for (const d of DRESSES) expect(O.costumes[COSTUME_OF[d]].length).toBe(4);
    for (const d of BUILT) for (const C of O.costumes[d]) {
      expect(C.triangles, `${d} LOD${C.lod}`).toBeLessThanOrEqual(budget[C.lod]);
      let mx = 0; for (const i of C.index) mx = Math.max(mx, i); expect(mx).toBeLessThan(C.tid.length);
      for (let k = 0; k < C.tid.length; k++) { let s = 0; for (let j = 0; j < 4; j++) { s += C.skinWeight[k * 4 + j]; if (C.skinWeight[k * 4 + j]) expect(C.skinIndex[k * 4 + j]).toBeLessThan(HBONES.length); } expect(Math.abs(s - 255)).toBeLessThanOrEqual(1); }
    }
    for (const d of DRESSES) for (const id of [...COSTUMES[d].always, ...COSTUMES[d].opt]) { const p = PIECES[id]; expect(p, id).toBeDefined(); expect(['A', 'B', 'C']).toContain(p.tier); expect(p.src.length).toBeGreaterThan(2); }
    console.log(BUILT.map(d => `${d}: ${O.costumes[d].map(c => `${c.triangles}/${c.bodyTriangles}`).join(' · ')}`).join('; '));
  });
  it('no piece or colour is named after a blocklisted thing (anachronism lint: ids and labels; notes may cite negatives)', () => {
    const block = JSON.parse(readFileSync('src/data/blocklist.json', 'utf8'));
    const terms = block.entries.flatMap((e: any) => e.terms.map((t: string) => ({ id: e.id, re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') })));
    for (const p of Object.values(PIECES)) for (const t of terms) expect(t.re.test(`${p.id} ${p.label}`), `${p.id} matches ${t.id}`).toBe(false);
    for (const k of Object.keys(TEXTILE)) for (const t of terms) expect(t.re.test(k)).toBe(false);
  });
  it('garment surfaces face outward and stay outside the body in the bind pose', () => {
    const v = A.byId.m05; // a variant that is not the reference
    for (const id of ['robe_upper@0', 'robe_skirt@0', 'tunic_upper@0', 'hat_fluted@0', 'dress_skirt@0']) {
      const g = O.geos![id], base = v.index * O.NV * 4 + O.pieceBase[id] * 4; let out = 0, tot = 0;
      // outward: the mean of (normal · (vertex − body axis)) over the outer layer is positive
      for (let i = 0; i < g.n; i++) { if (g.ao[i] === 150) continue; const x = O.source[base + i * 4], y = O.source[base + i * 4 + 1], z = O.source[base + i * 4 + 2]; const n = unpackNormal(O.source[base + i * 4 + 3]);
        const cx = 0, cz = id.startsWith('hat') ? v.joints[HB.head * 3 + 2] + 0.055 : 0.02; const r = [x - cx, 0, z - cz]; const l = Math.hypot(r[0], r[2]) || 1; tot++; if ((n[0] * r[0] + n[2] * r[2]) / l > -0.2) out++; void y; }
      expect(out / tot, `${id} outward`).toBeGreaterThan(0.85);
    }
  });
  it('the body under always-worn garments is dropped (fewer triangles, nothing to poke through)', () => {
    for (const d of ['persian', 'guard', 'median', 'woman'] as const) expect(O.costumes[COSTUME_OF[d]][0].bodyTriangles).toBeLessThan(A.lods[0].length / 3 * 0.8);
  });
});

describe('looks', () => {
  it('are deterministic, within the stature range, and wear only their costume’s pieces', () => {
    const roles = [['guard', 'guard', 'm'], ['median', 'guard', 'm'], ['persian', 'official', 'm'], ['worker', 'mason', 'm'], ['woman', 'grinder', 'f'], ['child', 'child', 'm']] as const;
    for (const [dress, role, sex] of roles) for (let s = 0; s < 20; s++) {
      const L1 = lookFor(A, { id: s, sex, role, dress, seed: 1000 + s }, 1), L2 = lookFor(A, { id: s, sex, role, dress, seed: 1000 + s }, 1);
      expect(L1).toEqual(L2);
      if (dress !== 'child') { const S = STATURE[sex]; expect(L1.stature).toBeGreaterThan(S.mean - 2.5 * S.sd - 0.03); expect(L1.stature).toBeLessThan(S.mean + 2.5 * S.sd + 0.03); }
      else expect(L1.stature).toBeLessThan(1.4);
      for (const id of L1.pieces) expect([...COSTUMES[dress].always, ...COSTUMES[dress].opt]).toContain(id);
      for (const id of COSTUMES[dress].opt) expect(((L1.mask >> pieceBit(dress, id)) & 1) === 1).toBe(L1.pieces.includes(id));
      for (const id of COSTUMES[dress].always) expect((L1.mask >> pieceBit(dress, id)) & 1).toBe(1); // guards' bow and quiver: bits of the shared costume
      if (sex === 'f') expect(L1.pieces.some(p => p.startsWith('beard'))).toBe(false);
      expect(L1.note).toMatch(/C/);
    }
  });
});

describe('crowd: pooling and the per-frame CPU budget (slice population + 300 extras)', () => {
  it('attaches and detaches people from a pool; posing 300 people stays within budget', () => {
    const img = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); return t; };
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const crowd = new Crowd(null, 1, humans);
    const specs = ['guard', 'median', 'persian', 'worker', 'woman', 'child'] as const;
    const anims = ['walk', 'idle', 'guard', 'chisel', 'grind', 'talk', 'sit', 'carry_shoulder'] as const;
    // a busy court: 300 people in front of the camera between 2 m and 60 m (all inside the view frustum)
    for (let i = 0; i < 300; i++) { const dress = specs[i % 6]; const d = 2 + 58 * Math.sqrt((i + 0.5) / 300), a = ((i * 0.618) % 1 - 0.5) * 1.2;
      crowd.addExtra(`x${i}`, { id: i, sex: dress === 'woman' ? 'f' : 'm', role: dress === 'guard' ? 'guard' : dress === 'child' ? 'child' : 'mason', dress, seed: 5000 + i, x: d * Math.sin(a), y: 0, z: -d * Math.cos(a), yaw: i, anim: anims[i % anims.length] }); }
    expect(humans.gpu.capacity).toBeGreaterThanOrEqual(300); // grew from 64
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    for (let f = 0; f < 20; f++) crowd.update(f / 30, cam.position, cam.position, cam); // warm-up (JIT)
    const ms: number[] = [], pms: number[] = []; for (let f = 0; f < 120; f++) { crowd.update(1 + f / 30, cam.position, cam.position, cam); ms.push(crowd.perf.ms); pms.push(crowd.perf.poseMs); }
    ms.sort((a, b) => a - b); const med = ms[60], p95 = ms[114];
    const st = crowd.stats();
    console.log(`crowd CPU (node, 300 people in view, 2–60 m): median ${med.toFixed(2)} ms/frame, p95 ${p95.toFixed(2)} ms; posed per frame ${st.perf.posed}; people per LOD ${st.byLod.join('/')}; draws ${st.draws} (+${st.propDraws} props); triangles submitted ${(st.triangles / 1e6).toFixed(2)} M (main pass)`);
    expect(st.people).toBe(300); expect(st.byLod[0]).toBeLessThanOrEqual(MAX_FULL); expect(MAX_FULL).toBeGreaterThanOrEqual(50); // brief: ≥ 50 at full detail
    expect(med).toBeLessThan(6); // budget (C): ≤ 6 ms/frame median in node for 300 visible people
    // detach frees slots for reuse
    const before = crowd.persons.size; crowd.removeExtras(); expect(crowd.persons.size).toBe(before - 300);
  }, 120_000);
  it('pools simulation agents by distance: attach within ATTACH_R, detach beyond DETACH_R or offmap; slots are reused', () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const dresses = ['guard', 'median', 'worker', 'woman'] as const;
    const agents = Array.from({ length: 60 }, (_, i) => ({ id: i, sex: i % 4 === 3 ? 'f' : 'm', role: ['guard', 'scribe', 'mason', 'grinder'][i % 4], dress: dresses[i % 4], origin: 'Persian', seed: 900 + i,
      pos: [i * 30, 0] as [number, number], y: 0, heading: 90, offmap: false, carry: null, gait: 0, metPlayer: 0, slot: [0, 0] }));
    const sim: any = { agents, stock: { depot: 0, store: 0 }, nav: { heightAt: () => 0 }, performance: () => ({ act: 'walk' }),
      // as PeopleSim.visibleAgents (D-024): on the map, within the radius, nearest first, capped
      visibleAgents: (c: [number, number], r: number, max = Infinity) => agents.filter(a => !a.offmap && Math.hypot(a.pos[0] - c[0], a.pos[1] - c[1]) <= r).sort((x, y) => Math.hypot(x.pos[0] - c[0], x.pos[1] - c[1]) - Math.hypot(y.pos[0] - c[0], y.pos[1] - c[1])).slice(0, max) };
    const crowd = new Crowd(sim, 1, humans); const pops: string[] = []; crowd.onPopIn = w => pops.push(w);
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(100, 1.6, 0); cam.updateMatrixWorld();
    agents[1].offmap = true; crowd.update(0, cam.position, null, cam);
    expect(pops).toEqual([]); // attaching at start is not a pop-in
    agents[1].offmap = false; crowd.update(0.05, cam.position, null, cam);
    expect(pops.length).toBe(1); // coming on the map 30 m ahead, in view, is (§13.8)
    const within = agents.filter(a => a.pos[0] < ATTACH_R).length; expect(crowd.persons.size).toBe(within);
    agents[5].offmap = true; cam.position.set(1700, 1.6, 0); cam.updateMatrixWorld(); crowd.update(0.1, cam.position, null, cam);
    expect([...crowd.persons.values()].every(p => Math.abs(p.agent!.pos[0] - 1700) < DETACH_R && !p.agent!.offmap)).toBe(true);
    const slots = [...crowd.persons.values()].map(p => p.slot); expect(new Set(slots).size).toBe(slots.length);
    expect(Math.max(...slots)).toBeLessThan(within + 25); // freed slots are reused, not appended forever
  });
  it('eyes look at a world target from any root (the rig solves in character space; the target is converted)', () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const crowd = new Crowd(null, 1, humans); const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000);
    for (const [x, z, yaw, side] of [[3, -4, 0.8, 0.25], [-40, 12, -2.2, -0.2], [0, 0, 0, 0]]) {
      crowd.removeExtras();
      const p = crowd.addExtra('g', { id: 1, sex: 'm', role: 'official', dress: 'persian', seed: 11, x, y: 0.5, z, yaw, anim: 'idle', look: null });
      const s = p.look.scale, v = A.variants[p.look.variant], cy = Math.cos(yaw), sy = Math.sin(yaw);
      // a target 0.7 m in front of the face and `side` m to his left (character +X → world (cy, 0, −sy); +Z → (sy, 0, cy))
      const t: [number, number, number] = [x + sy * 0.8 + cy * side, 0.5 + v.eyeY * s, z + cy * 0.8 - sy * side]; p.extra!.look = t;
      cam.position.set(t[0], t[1], t[2]); cam.lookAt(x, 0.5 + v.eyeY * s, z); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      crowd.update(1, cam.position, null, cam);
      for (const b of [HB.eye_l, HB.eye_r]) {
        const m = humans.gpu.palette.subarray(p.slot * PALETTE_STRIDE + b * 12, p.slot * PALETTE_STRIDE + b * 12 + 12);
        const jx = v.joints[b * 3], jy = v.joints[b * 3 + 1], jz = v.joints[b * 3 + 2];
        const ec = [m[0] * jx + m[1] * jy + m[2] * jz + m[3], m[4] * jx + m[5] * jy + m[6] * jz + m[7], m[8] * jx + m[9] * jy + m[10] * jz + m[11]]; // character space
        const ew = [x + s * (cy * ec[0] + sy * ec[2]), 0.5 + s * ec[1], z + s * (-sy * ec[0] + cy * ec[2])];
        const g = [cy * m[2] + sy * m[10], m[6], -sy * m[2] + cy * m[10]], d = [t[0] - ew[0], t[1] - ew[1], t[2] - ew[2]];
        const ang = Math.acos((g[0] * d[0] + g[1] * d[1] + g[2] * d[2]) / Math.hypot(...g) / Math.hypot(...d)) * 180 / Math.PI;
        expect(ang, `yaw ${yaw}, eye ${b}`).toBeLessThan(4); // within the plant offset's few cm at 0.7 m
      }
    }
  });
  it('an abstract-only (placeholder) activity reaching a rendered person is flagged, not faked', () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const agents = [0, 1].map(i => ({ id: i, sex: 'm', role: 'mason', dress: 'worker', origin: 'Persian', seed: 50 + i, pos: [4 + i, 0] as [number, number], y: 0, heading: 270, offmap: false, carry: null, gait: 0, metPlayer: 0, slot: [0, 0], walking: false }));
    // no activity is a placeholder any more (D-142): the flagging is proved on a synthetic one added for this test
    const ph = '__test_placeholder'; (ACTIVITIES as any)[ph] = { anim: 'idle', prop: null, sound: null, placeholder: true, abstractOnly: true, tier: 'C', note: 'PLACEHOLDER: a synthetic abstract-only activity (test)' };
    try {
    const sim: any = { agents, stock: { depot: 0, store: 0 }, nav: { heightAt: () => 0 }, performance: (a: any) => ({ act: a.id === 0 ? ph : 'dress_stone', moving: false }),
      visibleAgents: () => agents, greeting: () => 'none' };
    const crowd = new Crowd(sim, 1, humans); const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(10, 1.2, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    crowd.update(0, cam.position, null, cam);
    expect(crowd.stats().placeholderActs).toBe(1);
    const hits: THREE.Intersection[] = []; const rc = new THREE.Raycaster(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(1, 0, 0)); rc.intersectObject(crowd.group, true, hits);
    const h = hits.find(x => x.object.name === 'person:0')!; expect(h.object.userData.placeholder).toBe(true); expect(h.object.userData.note).toMatch(/PLACEHOLDER/);
    } finally { delete (ACTIVITIES as any)[ph]; }
  });
  it('people cast only into the shadow cascades that start within reach (CSM slices beyond are skipped)', () => {
    const cams = [0, 1, 2, 3].map(() => new THREE.OrthographicCamera());
    const light = new THREE.DirectionalLight(); (light.shadow as any).shadowNode = { lights: cams.map(c => ({ shadow: { camera: c } })), breaks: [0.125, 0.257, 0.43, 1], camera: { far: 20000 }, maxFar: 600 };
    shadowsSeePeople(light);
    expect(cams.map(c => cascadeNeedsPeople(c))).toEqual([true, true, false, false]); // slices start at 0, 75, 154, 258 m
    expect(cascadeNeedsPeople(new THREE.OrthographicCamera())).toBe(true); // a plain shadow map (no cascades)
    expect(light.shadow.camera.layers.isEnabled(SHADOW_LAYER)).toBe(true);
  });
  it('every activity prop exists', () => {
    for (const [id, p] of Object.entries(ACTIVITIES)) for (const v of [p, ...(p.variants ?? [])]) for (const k of [v.prop, v.prop2]) if (k) expect(PROPS[k] && propGeometry(PROPS[k].geom), `${id} ${k}`).toBeTruthy();
  });
});
void MAT;
