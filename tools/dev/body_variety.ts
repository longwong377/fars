// D-363 (T-E15): the drawn bodies of the population — each person's look as the game makes it (PopView.lookInput →
// looks.lookFor), and the deformation the render draws for it (the rig's girth and stoop in the rest pose, the fields of
// bodyShape.bodyFieldOffset, the fat belly's dome), measured on probe vertices of the person's own body variant.
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../../src/people/humanAssets';
import { lookFor, type PersonLook } from '../../src/people/looks';
import { PopView } from '../../src/people/popview';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../../src/people/humanRig';
import { NBONES } from '../../src/people/humanRig';
import { bodyFieldOffset, SHAPE_KEYS, EX } from '../../src/people/bodyShape';
import { bellyFrame, bellyOffset } from '../../src/people/drape';
import { PART, MAT } from '../../src/people/humanFormat';
import { buildPop } from './body_trace';
import { h32, salt } from '../../src/people/hash';

export function loadA(): HumanAssets { const b = readFileSync('public/generated/humans/humans.bin'); return decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
/** probe vertices per variant: every 37th body-surface vertex of the trunk, limbs and face (no hands, feet, eyes) */
export function probes(A: HumanAssets): number[] { const out: number[] = []; for (let i = 0; i < A.NO; i++) { const p = A.part[i]; if (p === PART.head ? i % 13 === 0 : i % 37 === 0) if (p <= PART.pelvis || p === PART.uarm_l || p === PART.uarm_r || p === PART.thigh_l || p === PART.thigh_r || p === PART.calf_l || p === PART.farm_l) out.push(i); } return out; }
/** the drawn displacement (m) of the probes for a look, in the rest pose (identity rotations), unit scale */
export function drawnOffsets(A: HumanAssets, look: PersonLook, P: number[], rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE)): Float32Array {
  const v = A.variants[look.variant], inp: RigInput = { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, body: look.body, t: 0 };
  rig.setPose(inp); rig.solve(inp, pal, 0);
  const ex = pal.subarray(NBONES * 12, PALETTE_STRIDE), F = bellyFrame(A, v), out = new Float32Array(P.length * 3), o3 = [0, 0, 0], q = [0, 0, 0];
  for (let k = 0; k < P.length; k++) { const i = P[k], x = v.pos[i * 3], y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2];
    bodyFieldOffset(x, y, z, A.skinIndex[i * 4], ex, true, o3); const b = bellyOffset(x, y, z, ex[EX.ex7], F);
    q[0] = x + o3[0]; q[1] = y + o3[1] + b.dy; q[2] = z + o3[2] + b.dz;
    const w = [0, 1, 2, 3].map(j => A.skinWeight[i * 4 + j] / 255), idx = [0, 1, 2, 3].map(j => A.skinIndex[i * 4 + j]); const s = skinPoint(pal, 0, idx, w, q);
    out[k * 3] = s[0] - x; out[k * 3 + 1] = s[1] - y; out[k * 3 + 2] = s[2] - z; }
  return out;
}
export interface Sample { pid: number; look: PersonLook; inp: ReturnType<PopView['lookInput']> }
/** up to n people of the population present on the day (drawn from the seed, never chosen), with the game's looks */
export function sample(seed: number, A: HumanAssets, n: number, day?: number): { day: number; people: Sample[] } {
  const pop = buildPop(seed), d = day ?? Math.floor((h32(seed, salt('body-variety'), 0) / 4294967296) * 300);
  const view = Object.create(PopView.prototype) as PopView; Object.assign(view, { pop, sim: { t: d * 24 + 10, agents: (pop as any).sim?.agents ?? [] }, seed });
  const ids = pop.persons.map(p => p.id).filter(pid => pop.persons[pid].agent < 0 && pop.present(pid, d) && pop.ageOn(pid, d) >= 0).sort((a, b) => h32(seed, salt('bv-order'), a) - h32(seed, salt('bv-order'), b)).slice(0, n);
  return { day: d, people: ids.map(pid => { const inp = view.lookInput(pid), look = lookFor(A, inp, seed), h = view.childStature(pid); if (h) { look.scale = h / A.variants[look.variant].height; look.stature = h; } /* as crowd.attachPop */ return { pid, inp, look }; }) };
}

/** the drawn difference (mm) of person a from the nearest other: same variant, the largest probe displacement difference and
 *  the stature difference at the crown; another variant is another mesh (Infinity) */
export function nearest(people: Sample[], offs: Float32Array[], a: number, A: HumanAssets): number {
  let best = Infinity; const la = people[a].look;
  for (let b = 0; b < offs.length; b++) { const lb = people[b].look; if (a === b || la.variant !== lb.variant) continue; let m = Math.abs(la.stature - lb.stature);
    for (let k = 0; k < offs[a].length && m < best; k++) m = Math.max(m, Math.abs(offs[a][k] - offs[b][k])); best = Math.min(best, m); }
  return best * 1000;
}
if (process.argv[1]?.endsWith('body_variety.ts')) {
  const A = loadA(), t0 = Date.now(), seed = Number(process.argv[2] ?? 1); const S = sample(seed, A, 3000); console.log('sample', S.people.length, 'day', S.day, (Date.now() - t0) + ' ms');
  const P = probes(A); console.log('probes', P.length);
  const offs = S.people.map(s => drawnOffsets(A, s.look, P)); console.log('offsets', (Date.now() - t0) + ' ms');
  // nearest neighbour RMS distance (mm) among the same variant
  const nn: number[] = []; for (let a = 0; a < offs.length; a++) { let best = 1e9; for (let b = 0; b < offs.length; b++) { if (a === b || S.people[a].look.variant !== S.people[b].look.variant) continue; let s2 = 0; for (let k = 0; k < offs[a].length; k++) { const d = offs[a][k] - offs[b][k]; s2 += d * d; } best = Math.min(best, Math.sqrt(s2 / P.length) * 1000); } nn.push(best); }
  const nm: number[] = []; for (let a = 0; a < offs.length; a++) nm.push(nearest(S.people, offs, a, A)); const nm0 = nm.slice(); nm.sort((x, y) => x - y); console.log('nn max mm: p1', nm[Math.floor(nm.length * 0.01)].toFixed(2), 'p5', nm[Math.floor(nm.length * 0.05)].toFixed(2), 'p50', nm[Math.floor(nm.length / 2)].toFixed(2), 'share >= 3 mm', (nm.filter(x => x >= 3).length / nm.length).toFixed(4));
  for (const g of ['child', 'm', 'f']) { const ii = S.people.map((p, i) => i).filter(i => g === 'child' ? S.people[i].look.dress === 'child' : S.people[i].look.dress !== 'child' && S.people[i].inp.sex === g); const v = ii.map(i => nm0[i]); console.log(g, ii.length, 'share >= 3 mm', (v.filter(x => x >= 3).length / v.length).toFixed(3)); }
  { const fails = S.people.map((p, i) => i).filter(i => nm0[i] < 3); const by: Record<string, number> = {}; for (const i of fails) { const k = (S.people[i].look.dress === 'child' ? 'c' : S.people[i].inp.sex) + (S.people[i].inp.life?.ageYears ?? -1); by[k] = (by[k] ?? 0) + 1; } console.log('fails by group+age', JSON.stringify(by)); }
  nn.sort((x, y) => x - y); console.log('nn rms mm: p1', nn[Math.floor(nn.length * 0.01)].toFixed(2), 'p5', nn[Math.floor(nn.length * 0.05)].toFixed(2), 'p50', nn[Math.floor(nn.length / 2)].toFixed(2));
  for (const k of SHAPE_KEYS) { const xs = S.people.map(s => (s.look.body!.shape as any)[k] as number), m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    const sk = xs.reduce((a, b) => a + ((b - m) / sd) ** 3, 0) / xs.length, ku = xs.reduce((a, b) => a + ((b - m) / sd) ** 4, 0) / xs.length - 3;
    console.log(k.padEnd(10), 'mean', m.toFixed(2), 'sd', sd.toFixed(2), 'skew', sk.toFixed(2), 'kurt', ku.toFixed(2), 'min', ((Math.min(...xs) - m) / sd).toFixed(1), 'max', ((Math.max(...xs) - m) / sd).toFixed(1)); }
  const mag = offs.map(o => { let m = 0; for (let k = 0; k < o.length; k += 3) m = Math.max(m, Math.hypot(o[k], o[k + 1], o[k + 2])); return m * 1000; }).sort((a, b) => a - b);
  console.log('max probe displacement mm p5/p50/p95/max', mag[Math.floor(mag.length * 0.05)].toFixed(1), mag[Math.floor(mag.length / 2)].toFixed(1), mag[Math.floor(mag.length * 0.95)].toFixed(1), mag[mag.length - 1].toFixed(1));
  const ages = S.people.map(s => s.inp.life?.ageYears ?? -1); console.log('ages', Math.min(...ages), Math.max(...ages), 'children', S.people.filter(s => s.look.dress === 'child').length, 'women', S.people.filter(s => s.inp.sex === 'f').length);
}
