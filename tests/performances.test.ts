// Activity performances (D-142): every activity the simulation can assign is performed with a pose cycle, props, work
// objects, animals and sound; none is a placeholder. Measured here (screenshots: tests/e2e/perf.spec.ts, shots/perf-*.png):
// the pose kit against the real rig, every cycle's reach and ground contact on several bodies, props in the right hands,
// work objects and animals within budget, the activity lint, the variant rules against the simulation's own reasons,
// and the crowd's draw and triangle cost for a mixed crowd of performers.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, meshoptSimplify, type HumanAssets } from '../src/people/humanAssets';
import { HB, PART } from '../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, PLANTED, skinPoint, type RigInput } from '../src/people/humanRig';
import { ANIMS, pose, type AnimId, type Pose } from '../src/people/anim';
import { WORK_ANIMS, WORK_META, ploughPath, workRoot, FURROW, type WorkAnim } from '../src/people/workAnims';
import { NOM, IK_STATS, trunk, gripIK, legIK, palmOf, ankleOf, shoulder, ANKLE_Y } from '../src/people/poseKit';
import { buildOutfits, type OutfitBuild } from '../src/people/outfits';
import { HumanGPU } from '../src/people/humanGPU';
import { Crowd, CARRIED_MAX, THINGS_DIST, IN_PLACE_RATE, yawOf } from '../src/people/crowd';
import { ACTIVITIES, ABSTRACT_PLACEHOLDERS, performanceFor, type ActivityId, type Performance } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';
import { PROPS, PROP_CLASSES, PROP_NOTES, propGeometry, propUnionGeometry, propSlot } from '../src/people/props';
import { propOf, type ViewPerson } from '../src/people/popview';
import { WORK_NOTES, workGeometry, type WorkKind } from '../src/people/workObjects';
import { SPECIES, ANIMAL_BUILD, animalGeometry, animalFrame, deformAnimal, animalsFor, lieDrop, grazeReach } from '../src/people/animals';
import { STRIKE_KINDS } from '../src/audio/soundscape';

let A: HumanAssets, O: OutfitBuild;
beforeAll(async () => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
  O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
}, 120_000);
const face = () => ({ jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 });
const inputFor = (v: HumanAssets['variants'][number], po: Pose, anim: AnimId): RigInput => ({ joints: v.joints, pose: po, face: face(), grip: [0.5, 0.5], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: PLANTED.has(anim), seat: !PLANTED.has(anim) && WORK_META[anim as WorkAnim]?.ground === 'seat' });
/** the lowest skinned point of body parts (every `step`-th vertex) */
function lowest(pal: Float32Array, v: HumanAssets['variants'][number], parts: Set<number>, step = 3) {
  let lo = 9; const o = [0, 0, 0];
  for (let i = 0; i < A.NO; i += step) { if (!parts.has(A.part[i])) continue; skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o); lo = Math.min(lo, o[1]); }
  return lo;
}
const FEET = new Set<number>([PART.foot_l, PART.foot_r]), HANDS = new Set<number>([PART.hand_l, PART.hand_r]);
const BODY = new Set<number>(Object.values(PART).filter(p => p < PART.eye));
/** cycle periods (s) for sampling whole cycles */
const PERIOD: Partial<Record<WorkAnim, number>> = { plough: 2 * (FURROW.len / FURROW.speed + FURROW.turn), herd: 26, spin: 22, irrigate: 14, groom: 11, drive: 26, polish: 9, tread: 1.5 };

describe('pose kit (D-142)', () => {
  it('the reference skeleton is the asset’s body m03 (within 1 mm)', () => {
    const v = A.byId.m03;
    for (const [name, p] of Object.entries(NOM)) { const b = (HB as any)[name]; expect(b, name).toBeDefined();
      for (let k = 0; k < 3; k++) expect(Math.abs(v.joints[b * 3 + k] - p[k]), `${name}[${k}]`).toBeLessThan(0.0012); }
  });
  it('arm and leg IK put palms and ankles on their targets on the real rig (palms within 5 mm, the kit’s FK within 3 mm of the rig’s)', () => {
    const v = A.byId.m03, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    for (let n = 0; n < 12; n++) {
      const po: Pose = { rot: { hips: [0.3 * Math.sin(n), 0.1 * Math.cos(n), 0], spine: [0.2 * (n % 3), 0.1 * Math.sin(2 * n), 0], chest: [0.1, 0, 0] }, hips: [0, -0.1 - 0.02 * n, -0.05] };
      const T = trunk(po), sl = shoulder(T, 'l'), sr = shoulder(T, 'r'); // targets within reach of each shoulder
      const gl: [number, number, number] = [sl[0] - 0.05, sl[1] - 0.3 - 0.01 * n, sl[2] + 0.3], gr: [number, number, number] = [sr[0] + 0.08, sr[1] - 0.25, sr[2] + 0.28 + 0.01 * n];
      gripIK(po, T, 'l', gl, [0.7, -1, -0.3], 0, 8); gripIK(po, T, 'r', gr, [-0.7, -1, -0.3], 0.4, 8); // converged (the crowd runs 4/2/1 passes by distance)
      legIK(po, T, 'l', [0.12, ANKLE_Y, 0.1], [0.2, 0, 1], 0.2); legIK(po, T, 'r', [-0.12, ANKLE_Y, -0.1], [-0.2, 0, 1], -0.2);
      const inp: RigInput = { joints: v.joints, pose: po, face: face(), grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1 };
      rig.setPose(inp); rig.solve(inp, pal, 0);
      const W = (b: number) => [rig.wt[b * 3], rig.wt[b * 3 + 1], rig.wt[b * 3 + 2]];
      const pl = palmOf(po, T, 'l'), pr = palmOf(po, T, 'r'), al = ankleOf(po, T, 'l');
      for (const [a, b] of [[pl, gl], [pr, gr]]) expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.005);
      expect(Math.hypot(...W(HB.foot_l).map((x, i) => x - al[i]) as [number, number, number])).toBeLessThan(0.003); // the kit's FK is the rig's
    }
  });
});

describe('work cycles: pose sanity (every cycle, many phases)', () => {
  it('every cycle is registered as an animation, poses finite channels and reaches its targets (grips ≤ 3.5 cm, feet ≤ 1 cm, reference body)', () => {
    for (const a of WORK_ANIMS) {
      expect(ANIMS).toContain(a);
      const P = PERIOD[a] ?? 9; let g = 0, l = 0;
      for (let i = 0; i < 64; i++) { const t = (i / 64) * P + 0.013; IK_STATS.reset(); const po = pose(a, t, t * 4.2, 0.7);
        for (const e of Object.values(po.rot)) for (const x of e!) expect(Number.isFinite(x), `${a} t ${t}`).toBe(true);
        for (const x of po.hips) expect(Number.isFinite(x)).toBe(true);
        g = Math.max(g, IK_STATS.grip); l = Math.max(l, IK_STATS.leg); }
      expect(g, `${a}: a hand misses its target by ${(g * 100).toFixed(1)} cm`).toBeLessThan(0.035);
      expect(l, `${a}: a foot misses its target by ${(l * 100).toFixed(1)} cm`).toBeLessThan(0.01);
    }
  });
  it('standing cycles are planted: the sole on the ground (±2 cm), no hand below it, and stationary feet do not skate (≤ 4 cm) — on three bodies', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    const moving = new Set<WorkAnim>(['plough', 'bier_l', 'bier_r', 'drive']); // walking, or shuffling as the team turns
    for (const vid of ['m03', 'f02', 'm08']) { const v = A.byId[vid];
      for (const a of WORK_ANIMS) { if (WORK_META[a].ground !== 'feet') continue; const P = PERIOD[a] ?? 9; const ank: number[][] = [];
        for (let i = 0; i < 16; i++) { const t = (i / 16) * P + 0.05; const inp = inputFor(v, pose(a, t, t * 4.2, 1.1), a); rig.setPose(inp); rig.solve(inp, pal, 0);
          const feet = lowest(pal, v, FEET, 2), hands = lowest(pal, v, HANDS, 4);
          expect(feet, `${a} on ${vid}: lowest foot point`).toBeGreaterThan(-0.02); expect(feet, `${a} on ${vid}: lowest foot point`).toBeLessThan(0.02);
          expect(hands, `${a} on ${vid}: a hand below the ground`).toBeGreaterThan(-0.03);
          ank.push([rig.wt[HB.foot_l * 3], rig.wt[HB.foot_l * 3 + 2], rig.wt[HB.foot_r * 3], rig.wt[HB.foot_r * 3 + 2]]); }
        if (moving.has(a) || a === 'tread') continue;
        for (let k = 0; k < 4; k++) { const xs = ank.map(r => r[k]); expect(Math.max(...xs) - Math.min(...xs), `${a} on ${vid}: a planted foot slides`).toBeLessThan(0.04); }
      } }
  }, 120_000);
  it('seated and kneeling cycles rest on the ground (the lowest body point within 3 cm of it) on three bodies', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
    for (const vid of ['m03', 'f02', 'c01']) { const v = A.byId[vid];
      for (const a of WORK_ANIMS) { if (WORK_META[a].ground !== 'seat') continue;
        for (const t of [0.4, 2.3, 5.1]) { const inp = inputFor(v, pose(a, t, t * 4, 0.5), a); expect(inp.seat).toBe(true); rig.setPose(inp); rig.solve(inp, pal, 0);
          const lo = lowest(pal, v, BODY, 3); expect(lo, `${a} on ${vid}`).toBeGreaterThan(-0.03); expect(lo, `${a} on ${vid}`).toBeLessThan(0.03); } } }
  }, 120_000);
  it('the ploughman walks the furrow at a steady pace and turns at the headland (the root path is continuous)', () => {
    let prev = ploughPath(0, 0.3), maxStep = 0;
    for (let i = 1; i < 2000; i++) { const t = i * 0.05, p = ploughPath(t, 0.3); maxStep = Math.max(maxStep, Math.hypot(p.dx - prev.dx, p.dz - prev.dz)); prev = p; }
    expect(maxStep).toBeLessThan(0.05 * 1.2); // ≤ 1.2 m/s everywhere: no jumps
    const mid = ploughPath(10, 0); expect(mid.turning).toBe(false);
  });
  it('tool work sounds come from the cycles: every sounding cycle fires at least one hit per cycle', () => {
    for (const [id, P0] of Object.entries(ACTIVITIES)) for (const P of [P0, ...(P0.variants ?? []).map(v => ({ ...P0, ...v }))]) {
      if (!P.sound || ['murmur', 'footsteps', 'fire', 'bleat', 'water', 'quern'].includes(P.sound) || !WORK_ANIMS.includes(P.anim as WorkAnim)) continue;
      const per = PERIOD[P.anim as WorkAnim] ?? 9; let hits = 0, last = false;
      for (let i = 0; i < 900; i++) { const po = pose(P.anim, (i / 900) * per * 1.5, 0, 0.2); if (po.hit && !last) hits++; last = !!po.hit; }
      expect(hits, `${id} (${P.anim}) makes its sound`).toBeGreaterThan(0);
    }
  });
});

describe('props (every kind tiered; in the right hands)', () => {
  it('every prop an activity names exists with geometry, a tier and a note; the two carried-prop unions stay within budget', () => {
    for (const [k, s] of Object.entries(PROPS)) { const g = propGeometry(s.geom); expect(g, k).not.toBeNull(); expect(PROP_NOTES[s.geom], k).toBeDefined(); expect(['A', 'B', 'C']).toContain(PROP_NOTES[s.geom].tier); }
    const tris = PROP_CLASSES.map((_, c) => propUnionGeometry(c).getAttribute('position').count / 3);
    console.log(`carried-prop unions: ${tris.join(' / ')} triangles per instance`);
    expect(tris[0]).toBeLessThanOrEqual(1000); expect(tris[1]).toBeLessThanOrEqual(700);
  });
  it('props sit in the hands that hold them: one-hand tools at their hand, two-hand tools through both palms, things held between the hands, the drawn bowstring at the drawing hand', () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(3, 2, 6);
    const V = THREE.Vector3; let checked = 0, bowDrawn = 0;
    for (const [act, P0] of Object.entries(ACTIVITIES) as [ActivityId, Performance][]) {
      for (let vi = -1; vi < (P0.variants?.length ?? 0); vi++) {
        const P = vi < 0 ? P0 : { ...P0, ...P0.variants![vi] }; const kinds = [P.prop, P.prop2].filter(k => k && PROPS[k].rule !== 'legacy') as string[]; if (!kinds.length) continue;
        const crowd = new Crowd(null, 1, humans); const p = crowd.addExtra('x', { id: 1, sex: 'm', role: 'mason', dress: 'worker', seed: 777, x: 1.5, y: 0, z: -0.5, yaw: 0.6, act, variant: vi < 0 ? undefined : vi, look: null });
        for (let f = 0; f < 24; f++) {
          const t = 1 + f * 0.83; crowd.update(t, cam.position, null, undefined);
          const pal = humans.gpu.palette, o = p.slot * PALETTE_STRIDE, J = A.variants[p.look.variant].joints;
          const bw = (b: number) => { const m = pal.subarray(o + b * 12, o + b * 12 + 12), x = J[b * 3], y = J[b * 3 + 1], z = J[b * 3 + 2]; return new V(m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]); };
          const rot = (b: number) => { const m = pal.subarray(o + b * 12, o + b * 12 + 12), s = p.look.scale; return (x: number, y: number, z: number) => new V(m[0] * x + m[1] * y + m[2] * z, m[4] * x + m[5] * y + m[6] * z, m[8] * x + m[9] * y + m[10] * z).divideScalar(s); };
          const grip = (s: 'l' | 'r') => bw(HB[`hand_${s}`]).lerp(bw(HB[`middle_01_${s}`]), 0.85).add(rot(HB[`hand_${s}`])(s === 'r' ? 0.022 : -0.022, 0, 0).multiplyScalar(p.look.scale)); // world, as props.ts gripPoint
          for (const [slot, kind] of [[0, p.prop], [1, p.prop2]] as const) {
            if (!kind || PROPS[kind].rule === 'legacy') continue; const S = PROPS[kind];
            const M = (slot ? p.propM2 : p.propM).clone(); // character space, as the palette (the root is applied per instance on the GPU)
            const org = new V().setFromMatrixPosition(M), ax = new V().setFromMatrixColumn(M, 2).normalize();
            const L = grip('l'), R = grip('r'), where = `${act}${vi >= 0 ? `/${vi}` : ''} ${kind} t ${t.toFixed(1)}`;
            switch (S.rule) {
              case 'one': expect(org.distanceTo(S.hand === 'l' ? L : R), where).toBeLessThan(0.02); break;
              case 'hang': case 'arrow': expect(org.distanceTo(R), where).toBeLessThan(0.02); break;
              case 'two': { const F = S.front === 'l' ? L : R, B = S.front === 'l' ? R : L; expect(org.distanceTo(F), where).toBeLessThan(0.02);
                const off = B.clone().sub(org); expect(off.sub(ax.clone().multiplyScalar(off.dot(ax))).length(), `${where}: the rear hand is off the handle`).toBeLessThan(0.03); break; }
              case 'mid': expect(Math.max(org.distanceTo(L), org.distanceTo(R)), `${where}: not held between the hands`).toBeLessThan(0.34); break;
              case 'palm': expect(org.distanceTo(S.hand === 'r' ? R : L), where).toBeLessThan(0.1); break;
              case 'hip': expect(org.distanceTo(L), where).toBeLessThan(0.15); break;
              case 'bow': { expect(org.distanceTo(L), where).toBeLessThan(0.02); const ip = p.ip[slot];
                const full = Math.max(0, L.distanceTo(R) - 0.14); // the draw that brings the string's middle to the drawing hand
                if (full > 0.2 && ip > 0.95 * full) { bowDrawn++; const mid = new V(0, 0, -0.14 - ip).applyMatrix4(M); expect(mid.distanceTo(R), `${where}: the drawn string is not at the drawing hand`).toBeLessThan(0.03); } break; }
              case 'at': { const holding = p.anim === 'mould' && org.y > 0.05; if (holding) { const hl = new V(0.225, 0.08, 0).applyMatrix4(M), hr = new V(-0.225, 0.08, 0).applyMatrix4(M);
                expect(hl.distanceTo(L), `${where}: the left hand off the mould`).toBeLessThan(0.08); expect(hr.distanceTo(R), `${where}: the right hand off the mould`).toBeLessThan(0.08); } break; }
            }
            checked++;
          }
        }
        crowd.removeExtras();
      }
    }
    console.log(`prop placements checked: ${checked}; drawn bowstrings checked: ${bowDrawn}`);
    expect(checked).toBeGreaterThan(300); expect(bowDrawn).toBeGreaterThan(0);
  }, 180_000);
});

describe('work objects and animals', () => {
  it('every work object kind builds within budget and carries a tier and a note', () => {
    const tris: string[] = [];
    for (const k of Object.keys(WORK_NOTES) as WorkKind[]) { const g = workGeometry(k); const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      expect(n, k).toBeGreaterThan(4); expect(n, k).toBeLessThanOrEqual(1500); expect(['A', 'B', 'C']).toContain(WORK_NOTES[k].tier); expect(WORK_NOTES[k].note.length).toBeGreaterThan(10);
      g.computeBoundingBox(); expect(g.boundingBox!.min.y, `${k} sits on the ground`).toBeGreaterThan(-0.12); tris.push(`${k} ${n}`); }
    console.log(`work objects (triangles): ${tris.join(', ')}`);
  });
  it('every species builds within budget; grazing brings the muzzle to the ground, walking swings the legs, lying rests the belly on the ground', () => {
    const PJ = JSON.parse(readFileSync('src/data/population.json', 'utf8')).animals.map((a: any) => a.id as string);
    for (const sp of SPECIES) {
      expect(sp === 'ox' || PJ.some((id: string) => id === sp || id.split('_').includes(sp)), `${sp} in population.json animals (cattle: Q-193)`).toBe(true);
      const g = animalGeometry(sp), n = g.getAttribute('position').count / 3; expect(n, sp).toBeLessThanOrEqual(1100);
      const P = g.getAttribute('position'), L = g.getAttribute('aLeg'), Pv = g.getAttribute('aPiv'), H = g.getAttribute('aHT');
      const at = (i: number, st: { phase: number; walk: number; graze: number; lie: number }) => deformAnimal(sp, [P.getX(i), P.getY(i), P.getZ(i)], [L.getX(i), L.getY(i), L.getZ(i), L.getW(i)], [Pv.getX(i), Pv.getY(i), Pv.getZ(i), Pv.getW(i)], [H.getX(i), H.getY(i), H.getZ(i), H.getW(i)], st, 0);
      let lowHead = 9, minStand = 9, maxLegDz = 0, lowBody = 9, legLow = 9;
      for (let i = 0; i < P.count; i++) {
        const stand = at(i, { phase: 0, walk: 0, graze: 0, lie: 0 }); minStand = Math.min(minStand, stand[1]);
        if (H.getX(i) > 0.5) lowHead = Math.min(lowHead, at(i, { phase: 0, walk: 0, graze: 1, lie: 0 })[1]);
        if (L.getY(i) > 0.5) { const a = at(i, { phase: 0, walk: 1, graze: 0, lie: 0 }), b = at(i, { phase: Math.PI, walk: 1, graze: 0, lie: 0 }); maxLegDz = Math.max(maxLegDz, Math.abs(a[2] - b[2]));
          legLow = Math.min(legLow, at(i, { phase: 0, walk: 0, graze: 0, lie: 1 })[1]); }
        else if (H.getX(i) === 0 && H.getY(i) === 0) lowBody = Math.min(lowBody, at(i, { phase: 0, walk: 0, graze: 0, lie: 1 })[1]);
      }
      expect(minStand, `${sp} stands on the ground`).toBeGreaterThan(-0.01); expect(minStand).toBeLessThan(0.02);
      expect(lowHead, `${sp} grazes`).toBeLessThan(0.08); expect(lowHead).toBeGreaterThan(-0.06);
      expect(maxLegDz, `${sp} walks`).toBeGreaterThan(0.1);
      expect(lowBody, `${sp} lies on its belly`).toBeGreaterThan(-0.06); expect(lowBody, `${sp} lies on its belly`).toBeLessThan(0.06);
      expect(legLow, `${sp}'s folded legs stay above the ground`).toBeGreaterThan(-0.12);
      expect(ANIMAL_BUILD[sp].tier.length).toBeGreaterThan(3); expect(lieDrop(sp)).toBeGreaterThan(0); expect(animalFrame(sp).graze).toBeGreaterThan(0.3); expect(grazeReach(sp)).toBeGreaterThan(0.2);
    }
  });
  it('animal placement is closed-form and bounded: a flock grazes about its herder, the plough team walks at the ploughman’s pace', () => {
    const f1 = animalsFor({ kind: 'flock', species: ['sheep', 'goat'], n: 12 }, 1234.5, 7), f2 = animalsFor({ kind: 'flock', species: ['sheep', 'goat'], n: 12 }, 1234.5, 7);
    expect(f1).toEqual(f2); expect(f1.length).toBe(12);
    for (let t = 0; t < 3000; t += 7.3) for (const a of animalsFor({ kind: 'flock', species: ['sheep'], n: 10 }, t, 3)) { expect(Math.hypot(a.x, a.z), 'within the flock’s range').toBeLessThan(14.5); expect(Number.isFinite(a.yaw)).toBe(true); expect(a.graze * a.walk).toBe(0); }
    // walking speed of flock animals between grazing spots ≤ 0.9 m/s
    let prev = animalsFor({ kind: 'flock', species: ['sheep'], n: 6 }, 0, 11); for (let t = 0.2; t < 400; t += 0.2) { const cur = animalsFor({ kind: 'flock', species: ['sheep'], n: 6 }, t, 11);
      cur.forEach((a, i) => expect(Math.hypot(a.x - prev[i].x, a.z - prev[i].z) / 0.2).toBeLessThan(0.9)); prev = cur; }
    const team = animalsFor({ kind: 'team', species: ['ox', 'ox'] }, 50, 1, { s: 10 }); expect(team.length).toBe(2); expect(team.every(a => a.follow && a.walk === 1)).toBe(true);
  });
});

describe('activity lint (brief §9.5): zero placeholders', () => {
  it('no activity is a placeholder or abstract-only; every performance and variant names a cycle, props, work objects, animals and a sound that exist', () => {
    expect(ABSTRACT_PLACEHOLDERS).toEqual([]);
    expect(activityLint(ACTIVITIES as any)).toEqual([]);
    for (const [id, P] of Object.entries(ACTIVITIES)) if (P.sound && !['murmur', 'footsteps', 'fire'].includes(P.sound)) expect(STRIKE_KINDS as readonly string[], id).toContain(P.sound);
  });
  it('the lint fails when a placeholder is added back, or a performance names something that does not exist', () => {
    const reg: any = { ...ACTIVITIES, weave: { anim: 'idle', tier: 'C', note: 'PLACEHOLDER, NO PERFORMANCE: weaving', placeholder: true, abstractOnly: true } };
    const bad = activityLint(reg); expect(bad.length).toBeGreaterThanOrEqual(3); expect(bad.join('\n')).toMatch(/weave: flagged placeholder/);
    expect(activityLint({ ...ACTIVITIES, reap: { ...ACTIVITIES.reap, prop: 'scythe' } } as any).join('\n')).toMatch(/prop 'scythe'/);
    expect(activityLint({ ...ACTIVITIES, herd: { ...ACTIVITIES.herd, animals: { kind: 'flock', species: ['camel'] } } } as any).join('\n')).toMatch(/animal 'camel'/);
  });
  it('the simulation’s own reasons select the intended performances', () => {
    const cases: [ActivityId, string, string][] = [
      ['haul', 'hauling a drum up the ramp to column 12', 'haul'], ['haul', 'unloading column drums from the quarry at the yard', 'haul'], ['haul', 'building up the earth ramp', 'pass'], ['haul', 'carrying dried bricks from the stacks to the wall', 'pass'],
      ['thresh', 'threshing: driving the animals round over the sheaves on the village floor (E-43)', 'drive'], ['thresh', 'winnowing in the afternoon wind', 'winnow'], ['thresh', 'turning the sheaves under the animals’ hooves on the threshing floor', 'drive'],
      ['thresh', 'turning the threshed straw; the air is too still to winnow', 'winnow'], ['reap', 'binding sheaves at the harvest', 'bind'], ['reap', 'reaping the barley (E-41)', 'reap'],
      ['field_work', 'driving the animals round the threshing floor with a stick', 'drive'], ['field_work', 'gleaning behind the reapers and carrying the sheaves to the stooks', 'gather'],
      ['field_work', 'gathering the straw on the threshing floor', 'winnow'], ['field_work', 'following the plough, dropping the seed of the summer crop into the furrow', 'fodder'], ['field_work', 'spreading manure on the field', 'fodder'],
      ['field_work', 'minding the crop and the water in the furrows', 'irrigate'], ['field_work', 'hoeing and weeding the growing crop', 'hoe'], ['field_work', 'mending the field banks and the water channels', 'hoe'],
      ['garden_work', 'pruning the trees', 'pick'], ['garden_work', 'digging dung into the beds', 'hoe'], ['gather', 'shaping dung cakes and setting them on the wall to dry', 'pat'],
      ['tend_animals', 'tending the relay horses', 'groom'], ['tend_animals', 'with the ewes at lambing (E-48)', 'fodder'], ['craft', 'firing the kiln', 'stoke'], ['craft', 'making pigments, Egyptian blue among them', 'grind'],
      ['craft', 'digging clay by the river', 'hoe'], ['craft', 'mending tools and baskets', 'mend'], ['dig_canal', 'clearing the canal with the men: filling the silt baskets and carrying them out', 'pass'],
      ['pick_fruit', 'treading the picked grapes in the press (E-45)', 'tread'], ['pick_fruit', 'the vintage: picking grapes (E-45)', 'pick'],
    ];
    for (const [act, why, anim] of cases) expect(performanceFor(act, why, 5).anim, `${act}: “${why}”`).toBe(anim);
    expect(performanceFor('tend_animals', 'tending the relay horses', 3).animals?.species).toEqual(['horse']);
    // offerings: never a gesture or a fire; shares of jar, sack and lead by seed
    const seen = new Set<string>(); for (let s = 0; s < 400; s++) { const P = performanceFor('offer', 'the lan (the regular offering; performance not attested)', s); seen.add(P.anim); expect(P.note).toMatch(/not (attested|shown)/i); }
    expect([...seen].sort()).toEqual(['hold', 'hold_lead', 'hold_sack']);
  });
});

describe('crowd: performers with their things and animals (budgets)', () => {
  it('300 performers of every activity: props, work objects and animals are instanced (a few draws each); CPU and triangles within budget', () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const crowd = new Crowd(null, 1, humans);
    const acts = (Object.keys(ACTIVITIES) as ActivityId[]).filter(a => ACTIVITIES[a].variants || ACTIVITIES[a].work || ACTIVITIES[a].animals || WORK_ANIMS.includes(ACTIVITIES[a].anim as WorkAnim));
    for (let i = 0; i < 300; i++) { const d = 3 + 57 * Math.sqrt((i + 0.5) / 300), a = ((i * 0.618) % 1 - 0.5) * 1.2, act = acts[i % acts.length];
      crowd.addExtra(`p${i}`, { id: i, sex: i % 3 ? 'm' : 'f', role: 'mason', dress: i % 3 ? 'worker' : 'woman', seed: 9000 + i * 13, x: d * Math.sin(a), y: 0, z: -d * Math.cos(a), yaw: i * 0.7, act, group: `g${Math.floor(i / 4)}` }); }
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    for (let f = 0; f < 20; f++) crowd.update(f / 30, cam.position, cam.position, cam);
    const ms: number[] = []; for (let f = 0; f < 90; f++) { crowd.update(1 + f / 30, cam.position, cam.position, cam); ms.push(crowd.perf.ms); }
    ms.sort((a, b) => a - b); const st = crowd.stats();
    console.log(`performers: ${st.people} in view; CPU median ${ms[45].toFixed(2)} ms, p95 ${ms[85].toFixed(2)} ms; props ${st.props} in ${st.propDraws} draws; work objects ${st.things.instances} in ${st.things.draws} draws (${(st.things.triangles / 1e3).toFixed(0)} k tris) ${JSON.stringify(st.things.kinds)}; animals ${st.animals.instances} in ${st.animals.draws} draws (${(st.animals.triangles / 1e3).toFixed(0)} k tris) ${JSON.stringify(st.animals.species)}; people ${(st.triangles / 1e6).toFixed(2)} M tris in ${st.draws} draws`);
    expect(st.placeholderActs).toBe(0);
    expect(st.propDraws).toBeLessThanOrEqual(2); expect(st.props).toBeLessThanOrEqual(2 * CARRIED_MAX);
    expect(st.animals.draws).toBeLessThanOrEqual(SPECIES.length); expect(st.things.draws).toBeLessThanOrEqual(Object.keys(WORK_NOTES).length);
    expect(st.things.triangles + st.animals.triangles).toBeLessThan(1.2e6);
    expect(st.animals.dropped, 'animals over the instance cap').toBe(0); expect(st.things.dropped, 'work objects over the instance cap').toBe(0);
    // WebGPU allows 8 vertex buffers per pipeline: every attribute buffer of the geometry (an interleaved buffer counts
    // once) plus the instance matrix and colour must fit (an upper bound: unused attributes are counted too)
    let checkedMeshes = 0;
    crowd.group.traverse(o => { const im = o as THREE.InstancedMesh; if (!im.isInstancedMesh || !/^(props|work|animals):/.test(im.name)) return;
      const bufs = new Set<unknown>(); for (const a of Object.values(im.geometry.attributes)) bufs.add((a as any).isInterleavedBufferAttribute ? (a as any).data : a);
      const n = bufs.size + 1 + (im.instanceColor ? 1 : 0); expect(n, `${im.name}: vertex buffers`).toBeLessThanOrEqual(8); checkedMeshes++; });
    expect(checkedMeshes).toBeGreaterThan(10);
    expect(ms[45]).toBeLessThan(10); // node, 300 performers in view (the crowd's people-only budget is 6 ms: humans_runtime)
  }, 180_000);
});

describe('population people perform too (the D-142 × D-143 merge)', () => {
  // a crowd with a population view (a stub here; the view itself: tests/popview.test.ts): people attached by population id
  // and placed by the view's ViewPerson, as crowd.feedPool does
  const makeCrowd = () => {
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 64 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const crowd = new Crowd(null, 1, humans);
    crowd.view = { lookInput: (pid: number) => ({ id: 100000 + pid, sex: 'm', role: 'porter', dress: 'worker', origin: 'persian', seed: 7777 + pid * 31 }), childStature: () => null,
      geo: { plotAt: () => 0 }, stats: {}, pop: { persons: [], nameOf: () => null } } as any;
    return crowd;
  };
  const vpOf = (pid: number, e: number, n: number, act: ActivityId, why: string, o: Partial<ViewPerson> = {}): ViewPerson =>
    ({ pid, e, n, y: 0, heading: 180, act, moving: false, why, place: '', prop: propOf(act, o.carryNote ?? null), carryNote: null, speed: 0, entry: 0, what: 'test', agent: -1, plot: 0, wall: 0, hh: -1, ...o });
  it('resolve() takes a population person\'s act and reason from the view (vp.act, vp.why): D-142\'s variant, props, work objects and animals; the plan\'s goods carried where the activity has no prop; no placeholder', () => {
    const crowd = makeCrowd(), frame = () => (crowd as any).frame as number;
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const V = [
      vpOf(1, -3, 10, 'thresh', 'threshing: driving the animals round over the sheaves on the village floor (E-43)', { place: 'threshing:v1' }),
      vpOf(2, 1, 12, 'thresh', 'threshing and winnowing on the village floor (E-43)', { place: 'threshing:v1' }),
      vpOf(3, 3, 8, 'walk', 'walking', { moving: true, speed: 1.3, carryNote: 'a sack of barley from the store' }),
      vpOf(4, -1, 7, 'gather', 'shaping dung cakes and setting them out to dry'),
      vpOf(5, 2, 15, 'reap', 'reaping the barley', { moving: true, speed: 0.3 }), // stepping aside on arriving: a walk
      vpOf(6, -4, 16, 'field_work', 'hoeing the fields'),
    ];
    expect(V[2].prop, 'the view reads the goods from the plan\'s words').toBe('sack');
    const P = V.map(v => [crowd.attachPop(v.pid), v] as const);
    for (let f = 0; f < 3; f++) { for (const [p, v] of P) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(f / 30, cam.position, cam.position, cam); }
    const st = crowd.stats();
    for (const [p, v] of P) {
      const act = v.moving && !ACTIVITIES[v.act].moving ? 'walk' : v.act, want = performanceFor(act, v.why, Math.round(p.animK * 159));
      expect(p.drawnFrame, `p${v.pid} drawn`).toBe(frame());
      expect(p.act, `p${v.pid}`).toBe(act); expect(p.why, `p${v.pid}`).toBe(v.why);
      expect((p.perf as { variant?: number } | null)?.variant, `p${v.pid}`).toBe(want.variant); expect(p.anim, `p${v.pid}`).toBe(want.anim); expect(p.actPlaceholder).toBe(false);
    }
    const get = (pid: number) => crowd.persons.get(`p${pid}`)!;
    expect(get(1).anim).toBe('drive'); expect(get(1).prop).toBe('goad');
    expect(get(2).anim).toBe('winnow'); expect(get(2).prop).toBe('fork');
    expect(get(3).anim).toBe('walk'); expect(get(3).prop).toBe('sack'); // the plan's goods, carried as D-142's prop
    expect(get(4).anim).toBe('pat'); expect(get(4).prop, 'a variant that leaves the prop out keeps the hands free').toBeNull();
    expect(get(5).act).toBe('walk'); expect(get(5).prop, 'stepping aside on arriving, the reaper carries the sickle he came to reap with').toBe('sickle');
    expect(get(6).anim).toBe('hoe'); expect(get(6).prop).toBe('hoe');
    // the props are D-142's instanced props (kind index per instance, per prop class)
    const meshes = crowd.group.children.filter(o => (o as THREE.InstancedMesh).isInstancedMesh && /^props:/.test(o.name)) as THREE.InstancedMesh[];
    const kindsIn = (c: number) => { const im = meshes.find(m => m.name === (c === 0 ? 'props:carried' : 'props:tools'))!; const ik = im.geometry.getAttribute('ik') as THREE.InterleavedBufferAttribute; return Array.from({ length: im.count }, (_, i) => ik.getX(i)); };
    for (const k of ['sack', 'goad', 'fork', 'hoe']) { const [c, i] = propSlot(k)!; expect(kindsIn(c), k).toContain(i); }
    // D-142's work objects and animals: one threshing floor for the two at the same place (keyed by the plan's place), the
    // driver's oxen, the winnower's grain heap, the dung cakes
    expect(st.things.kinds.threshing_floor).toBe(1); expect(st.things.kinds.grain_heap).toBe(1); expect(st.things.kinds.dung_cakes).toBe(1);
    expect(st.animals.species.ox).toBeGreaterThanOrEqual(2);
    expect(st.placeholderActs).toBe(0); expect(st.propsDropped).toBe(0);
    // the performance follows the plan's reason when it changes (the resolve cache is keyed by act and reason)
    V[1].why = 'threshing: driving the animals round over the sheaves on the village floor (E-43)';
    for (const [p, v] of P) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(0.2, cam.position, cam.position, cam);
    expect(get(2).why).toBe(V[1].why); expect(get(2).anim).toBe('drive'); expect(crowd.stats().things.kinds.threshing_floor).toBe(1);
    // a person the view does not place this frame is not drawn (and not resolved from a stale place)
    get(6).vpFrame = -10; for (const [p, v] of P) if (v.pid !== 6) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(0.25, cam.position, cam.position, cam);
    expect(get(6).shown).toBe(false); expect(get(6).drawnFrame).toBeLessThan(frame());
    // removing the extras keeps the pool's population people (attached by population id)
    crowd.addExtra('x', { id: -5, sex: 'm', role: 'porter', dress: 'worker', seed: 5, x: 0, y: 0, z: -5, yaw: 0 }); crowd.removeExtras();
    expect(crowd.persons.size).toBe(6); expect(crowd.attachPop(3)).toBe(get(3));
  }, 120_000);
  it('a shared work object stays where it is when the camera turns or the field of view changes (anchored among the view\'s people, not those drawn); one bier per funeral (place and household)', () => {
    const crowd = makeCrowd(), frame = () => (crowd as any).frame as number;
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0);
    const look = (e: number, n: number, fov: number) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(e, 1.2, -n); cam.updateMatrixWorld(); };
    const V = [
      vpOf(1, -14, 20, 'thresh', 'threshing and winnowing on the village floor (E-43)', { place: 'threshing:v1' }),
      vpOf(2, 0, 20, 'thresh', 'threshing: driving the animals round over the sheaves on the village floor (E-43)', { place: 'threshing:v1' }),
      // two funerals at the town's burial ground the same day: households 5 (two bearers) and 6
      vpOf(10, -30, 30, 'carry_bier', 'the dead are carried out of the settlement (E-71)', { place: 'outside', hh: 5 }),
      vpOf(11, -26, 34, 'carry_bier', 'the dead are carried out of the settlement (E-71)', { place: 'outside', hh: 5 }),
      vpOf(12, -34, 38, 'carry_bier', 'the dead are carried out of the settlement (E-71)', { place: 'outside', hh: 6 }),
    ];
    const P = V.map(v => [crowd.attachPop(v.pid), v] as const);
    const at = (kind: string) => { const m = crowd.group.getObjectByName(`work:${kind}`) as THREE.InstancedMesh | undefined, M = new THREE.Matrix4();
      return Array.from({ length: m?.count ?? 0 }, (_, i) => { m!.getMatrixAt(i, M); return new THREE.Vector3().setFromMatrixPosition(M); }); };
    let t = 0; const step = () => { for (const [p, v] of P) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(t += 0.1, cam.position, null, cam); };
    const drawn = (pid: number) => crowd.persons.get(`p${pid}`)!.drawnFrame === frame();
    // the floor stands at the lowest population id of the place (p1) in every view that draws a performer of it: p1 in
    // view or not, the field of view wide or narrow (before the fix it jumped 14 m to p2 when p1 left the view)
    const rows: string[] = [];
    for (const [e, n, fov] of [[-14, 20, 70], [0, 20, 70], [20, 20, 70], [8, 20, 20], [0, 20, 70], [-14, 20, 20], [20, 20, 70]] as const) {
      look(e, n, fov); step(); const f = at('threshing_floor'); rows.push(`look E ${e} fov ${fov}: p1 ${drawn(1)} p2 ${drawn(2)} floor ${f.map(v => `${v.x.toFixed(1)},${(-v.z).toFixed(1)}`)}`);
      expect(drawn(1) || drawn(2), `look E ${e}: a thresher drawn`).toBe(true);
      expect(f.length, rows.at(-1)).toBe(1); expect(f[0].distanceTo(new THREE.Vector3(-14, 0, -20)), rows.at(-1)).toBeLessThan(1e-6); }
    expect(rows.filter(r => r.includes('p1 false')).length, 'some views leave p1 out').toBeGreaterThan(0);
    // looking away from the floor and its performers: not drawn
    look(0, -20, 70); step(); expect(drawn(1) || drawn(2)).toBe(false); expect(at('threshing_floor').length).toBe(0);
    // the biers: one per household, at its lowest id bearer (the pole's side offset: 0.46 m)
    look(-30, 34, 70); step(); const B = at('bier');
    expect(B.length, 'two funerals at one place: two biers').toBe(2);
    expect(Math.min(...B.map(v => v.distanceTo(new THREE.Vector3(-30, 0, -30)))), 'household 5\'s bier at bearer p10').toBeLessThan(0.5);
    expect(Math.min(...B.map(v => v.distanceTo(new THREE.Vector3(-34, 0, -38)))), 'household 6\'s bier at bearer p12').toBeLessThan(0.5);
    console.log(rows.join('\n'));
  }, 120_000);
  it('a moving performance at a standing spot of the plan walks in place (the bearers at the burial ground, a guard\'s round at his post), skinned and impostor', () => {
    const crowd = makeCrowd(), frame = () => (crowd as any).frame as number;
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const V = [vpOf(1, -2, 12, 'carry_bier', 'the dead are carried out of the settlement (E-71)', { place: 'outside', hh: 3 }), vpOf(2, 2, 14, 'patrol', 'walking the round of the Terrace', { place: 'terrace_round' })];
    const P = V.map(v => [crowd.attachPop(v.pid), v] as const), th: number[][] = [[], []];
    // and a guard on his round drawn as an impostor (beyond the pool): his walk frames run
    const rows = new Set<number>(); crowd.imp = { begin() {}, end() {}, count: 0, atlas: { refStature: {} }, push(_x: number, _y: number, _z: number, _yaw: number, row: number) { rows.add(row); } } as any;
    const g = vpOf(3, 5, 700, 'patrol', 'walking the round of the Terrace', { place: 'terrace_round' }); (crowd as any).impList = [{ vp: g, a: null, d: 700, x: g.e, y: 0, z: -g.n, yaw: yawOf(g.heading) }]; (crowd as any).nImp = 1;
    for (let f = 0; f < 31; f++) { for (const [p, v] of P) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(1 + f / 30, cam.position, null, cam);
      P.forEach(([p], i) => th[i].push(p.rig.pose.rot.l_thigh?.[0] ?? 0)); }
    expect(rows.size, 'the impostor guard\'s walk frames over a second').toBeGreaterThanOrEqual(3);
    expect(['bier_l', 'bier_r']).toContain(P[0][0].anim); expect(P[1][0].anim).toBe('guard_walk');
    for (const [i, x] of th.entries()) { const r = Math.max(...x) - Math.min(...x); expect(r, `${V[i].act}: the thigh swings over a second (it stood frozen mid-stride)`).toBeGreaterThan(0.3); }
    // the phase runs at the extras' pace (time × 4.2)
    const g0 = P[0][0].gaitPh; for (const [p, v] of P) { p.vp = v; p.vpFrame = frame() + 1; } crowd.update(2 + 0.4, cam.position, null, cam);
    expect(P[0][0].gaitPh - g0).toBeCloseTo(IN_PLACE_RATE * 0.4, 6);
  }, 120_000);
  it('impostors within THINGS_DIST bring their work objects and animals, the ploughman on his furrow (as the skinned do); beyond it, only the body; the skinned ploughman\'s root (his capsule) is on the furrow', () => {
    const crowd = makeCrowd(); const pushed: number[][] = [];
    crowd.imp = { begin() { this.count = 0; pushed.length = 0; }, end() {}, count: 0, atlas: { refStature: {} }, push(x: number, y: number, z: number, yaw: number) { pushed.push([x, y, z, yaw]); this.count++; } } as any;
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 5000); cam.position.set(0, 1.6, 0); cam.lookAt(0, 1.2, -10); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const V = [vpOf(20, 0, 150, 'plough', 'ploughing and sowing the field'), vpOf(21, 20, 200, 'reap', 'reaping the barley'), vpOf(22, -10, THINGS_DIST + 60, 'reap', 'reaping the barley'),
      vpOf(23, -20, 300, 'thresh', 'threshing and winnowing on the village floor (E-43)', { place: 'threshing:v9' })];
    (crowd as any).impList = V.map(v => ({ vp: v, a: null, d: Math.hypot(v.e, v.n), x: v.e, y: v.y, z: -v.n, yaw: yawOf(v.heading) })); (crowd as any).nImp = V.length;
    const T = 3; crowd.update(T, cam.position, null, cam); const st = crowd.stats();
    expect(pushed.length, 'every impostor in view drawn').toBe(4);
    expect(st.animals.species.ox, 'the plough team').toBe(2); expect(st.things.kinds.ard).toBe(1);
    expect(st.things.kinds.sheaves, 'the reaper within THINGS_DIST has his sheaves; the one beyond has none').toBe(1);
    expect(st.things.kinds.threshing_floor, 'the floor of a place whose only performer in view is an impostor').toBe(1); expect(st.things.kinds.grain_heap).toBe(1);
    // the ploughman impostor is on his furrow, where the skinned would be (the root: the view's spot plus workRoot)
    const s = crowd.view!.lookInput(20).seed, o = workRoot('plough', T + s % 100, (s % 1000) / 159)!, yaw = yawOf(180), c = Math.cos(yaw), sn = Math.sin(yaw);
    expect(Math.hypot(o[0], o[1])).toBeGreaterThan(0.5);
    const want = [0 + c * o[0] + sn * o[1], -150 - sn * o[0] + c * o[1]]; const got = pushed.find(q => Math.hypot(q[0] - want[0], q[2] - want[1]) < 1e-6);
    expect(got, `ploughman at ${want.map(x => x.toFixed(2))}; impostors at ${JSON.stringify(pushed.map(q => q.map(x => +x.toFixed(2))))}`).toBeTruthy();
    expect(got![3]).toBeCloseTo(yaw + o[2], 9);
    // a skinned ploughman of the population: where he is drawn (rootOf; world.ts puts his collision capsule there) is on his
    // furrow as well, not at the view's spot
    const pv = vpOf(30, 3, 12, 'plough', 'ploughing and sowing the field'), pp = crowd.attachPop(30); pp.vp = pv; pp.vpFrame = (crowd as any).frame + 1;
    const T2 = T + 0.5; crowd.update(T2, cam.position, null, cam); const s2 = crowd.view!.lookInput(30).seed, o2 = workRoot('plough', T2 + s2 % 100, (s2 % 1000) / 159)!, R = crowd.rootOf(30)!;
    expect(Math.hypot(R[0] - (3 + c * o2[0] + sn * o2[1]), R[2] - (-12 - sn * o2[0] + c * o2[1]))).toBeLessThan(1e-9); expect(Math.hypot(o2[0], o2[1])).toBeLessThan(9);
    expect(crowd.rootOf(31), 'not in the pool').toBeNull();
  }, 120_000);
});
