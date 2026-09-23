// Human bodies from the MakeHuman CC0 assets (D-016). Downloads the base mesh, macro/face targets, the game-engine rig
// + weights (MPFB2), the default rig's face bones + weights, the eye proxy and its texture into data/makehuman/
// (gitignored) and derives compact runtime assets into public/generated/humans/:
//   humans.json  metadata: skeleton, body variants (macro values, bind joints), LOD index ranges, landmarks, tiers
//   humans.bin   shared topology (uv, index LODs, skin indices/weights, part ids) + Int16 positions per variant
//   skin.png     skin albedo detail (UV space, baked from 3-D procedural functions on the reference body; C)
//   eye.png      MakeHuman brown eye texture, downscaled (CC0)
// Every variant is skinned to one skeleton (src/people/humanFormat.ts) and re-posed at build time from MakeHuman's
// A-pose to arms hanging and feet under the hips, which is the bind pose the animation system assumes.
// Run: npx tsx tools/build_humans.ts [--preview]   (previews → shots/humans_*.png)
import { mkdirSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { mh, mpfb, mhTry, parseObj, parseTarget, applyTarget, parseMhclo, fitMhclo, macroTargets, modifierTarget, ageYearsToValue, Macro, Target } from './humans/mh';
import { encodePNG, decodePNG, downscale } from './humans/png';
import { preview } from './humans/raster';
import { bakeSkin, cavityAO, vertexMasks } from './humans/skin';
import { HBONES, HPARENT, HB, HBone, PART, FINGERS, HumanAssetsMeta, HumanVariantMeta } from '../src/people/humanFormat';

const OUT = 'public/generated/humans';
const PREVIEW = process.argv.includes('--preview');
const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- variants (tier C: macro values chosen for variety)
// blend = MakeHuman's three population morphs (named african/asian/caucasian in its files). They are used here ONLY
// as a source of physical variety, never as a claim about any people of the empire; the overlay calls them "variant".
interface VDef { id: string; sex: 'm' | 'f'; age: number; muscle: number; weight: number; height: number; prop: number; blend: [number, number, number]; seed: number }
const V: VDef[] = [
  ['m01', 'm', 22, .60, .42, .50, .60, [.20, .15, .65]], ['m02', 'm', 26, .70, .38, .45, .55, [.30, .10, .60]], ['m03', 'm', 30, .55, .55, .55, .50, [.10, .25, .65]],
  ['m04', 'm', 34, .50, .62, .40, .50, [.25, .20, .55]], ['m05', 'm', 40, .60, .50, .60, .55, [.15, .10, .75]], ['m06', 'm', 24, .65, .45, .52, .60, [.40, .10, .50]],
  ['m07', 'm', 28, .50, .40, .38, .50, [.10, .35, .55]], ['m08', 'm', 45, .45, .66, .50, .45, [.20, .20, .60]], ['m09', 'm', 32, .62, .48, .62, .55, [.35, .15, .50]],
  ['m10', 'm', 20, .50, .36, .48, .55, [.15, .30, .55]], ['m11', 'm', 38, .58, .58, .44, .50, [.30, .20, .50]], ['m12', 'm', 27, .66, .50, .57, .60, [.05, .20, .75]],
  ['m13', 'm', 55, .45, .50, .45, .50, [.20, .15, .65]], ['m14', 'm', 62, .40, .40, .50, .45, [.30, .10, .60]], ['m15', 'm', 58, .50, .62, .42, .50, [.10, .25, .65]],
  ['f01', 'f', 22, .50, .45, .50, .55, [.20, .15, .65]], ['f02', 'f', 28, .45, .55, .45, .50, [.30, .15, .55]], ['f03', 'f', 34, .50, .50, .55, .50, [.10, .30, .60]],
  ['f04', 'f', 25, .55, .40, .50, .55, [.35, .10, .55]], ['f05', 'f', 52, .45, .60, .45, .45, [.20, .20, .60]],
  ['c01', 'm', 8, .50, .45, .50, .50, [.20, .15, .65]], ['c02', 'm', 10, .50, .40, .50, .50, [.30, .15, .55]], ['c03', 'f', 9, .50, .45, .50, .50, [.15, .25, .60]],
].map(([id, sex, age, muscle, weight, height, prop, blend], i) => ({ id, sex, age, muscle, weight, prop, blend, seed: 1000 + i,
  // statures of the period were lower than MakeHuman's modern defaults (C): men's height macro lowered by 0.10
  height: sex === 'm' && (age as number) >= 14 ? (height as number) - 0.10 : height } as VDef));
const REF = 'm03'; // reference body for LOD simplification, landmarks and the skin bake

// face detail modifiers (MakeHuman modeling_modifiers.json names), value ranges for seeded variety (C)
const FACE: [string, string, [string, string], number, number][] = [
  ['nose', 'nose-hump', ['decr', 'incr'], -0.2, 0.8], ['nose', 'nose-scale-vert', ['decr', 'incr'], -0.3, 0.5], ['nose', 'nose-scale-horiz', ['decr', 'incr'], -0.3, 0.3],
  ['nose', 'nose-point', ['down', 'up'], -0.5, 0.2], ['nose', 'nose-volume', ['decr', 'incr'], -0.2, 0.4], ['mouth', 'mouth-lowerlip-volume', ['decr', 'incr'], -0.3, 0.4],
  ['mouth', 'mouth-upperlip-volume', ['decr', 'incr'], -0.3, 0.3], ['mouth', 'mouth-scale-horiz', ['decr', 'incr'], -0.3, 0.3], ['chin', 'chin-prominent', ['decr', 'incr'], -0.3, 0.5],
  ['chin', 'chin-width', ['decr', 'incr'], -0.3, 0.4], ['eyebrows', 'eyebrows-trans', ['down', 'up'], -0.5, 0.2], ['forehead', 'forehead-scale-vert', ['decr', 'incr'], -0.3, 0.3],
  ['head', 'head-scale-horiz', ['decr', 'incr'], -0.2, 0.2], ['cheek', 'l-cheek-bones', ['decr', 'incr'], -0.3, 0.5], ['eyes', 'l-eye-scale', ['decr', 'incr'], -0.3, 0.2],
];
const MIRROR: Record<string, string> = { 'l-cheek-bones': 'r-cheek-bones', 'l-eye-scale': 'r-eye-scale' };
const rnd = (seed: number) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------------------------------------------------------------- load sources
log('fetching MakeHuman assets (cached in data/makehuman/)');
const obj = parseObj((await mh('data/3dobjs/base.obj')).toString('utf8'));
const NB = obj.v.length / 3; // 19158 base vertices (body + helpers + joint cubes)
const vgroups: Record<string, [number, number][]> = JSON.parse((await mpfb('src/mpfb/data/mesh_metadata/basemesh_vertex_groups.json')).toString());
const rigGE: Record<string, any> = JSON.parse((await mpfb('src/mpfb/data/rigs/standard/rig.game_engine.json')).toString());
const wGE: Record<string, [number, number][]> = JSON.parse((await mpfb('src/mpfb/data/rigs/standard/weights.game_engine.json')).toString()).weights;
const skDef = JSON.parse((await mh('data/rigs/default.mhskel')).toString());
const wDef: Record<string, [number, number][]> = JSON.parse((await mh('data/rigs/default_weights.mhw')).toString()).weights;
const eyeClo = parseMhclo((await mh('data/eyes/high-poly/high-poly.mhclo')).toString());
const eyeObj = parseObj((await mh('data/eyes/high-poly/high-poly.obj')).toString());
const eyeLoClo = parseMhclo((await mh('data/eyes/low-poly/low-poly.mhclo')).toString());
const eyeLoObj = parseObj((await mh('data/eyes/low-poly/low-poly.obj')).toString());
const eyeTex = decodePNG(await mh('data/eyes/materials/brown_eye.png'));
await mh('data/eyes/materials/brown.mhmat'); await fetchLicences();
async function fetchLicences() { await mh('../LICENSE.md').catch(() => null); await mpfb('LICENSE.md').catch(() => null); }
const range = (g: string) => { const r = vgroups[g]; if (!r) throw new Error('no group ' + g); const out: number[] = []; for (const [a, b] of r) for (let i = a; i <= b; i++) out.push(i); return out; };
const cubeMean = (pos: Float64Array, g: string) => { const ids = range(g); const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / ids.length; return c; };
const listMean = (pos: Float64Array, ids: number[]) => { const c = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) c[k] += pos[i * 3 + k] / ids.length; return c; };

// ---------------------------------------------------------------- vertex set: body + eyelashes + teeth + tongue + eyes
const HELPERS = ['helper-l-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-1', 'helper-r-eyelashes-2', 'helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue'];
const helperPart: Record<string, number> = { 'helper-upper-teeth': PART.teeth, 'helper-lower-teeth': PART.teeth, 'helper-tongue': PART.tongue };
const keep: number[] = []; // base vertex ids kept, in P order
const pOfBase = new Int32Array(NB).fill(-1);
for (let i = 0; i < 13380; i++) { pOfBase[i] = keep.length; keep.push(i); }
for (const g of HELPERS) for (const i of range(g)) if (pOfBase[i] < 0) { pOfBase[i] = keep.length; keep.push(i); }
const nEye = eyeClo.refs.length / 3, nEyeLo = eyeLoClo.refs.length / 3;
const P0 = keep.length, PE = P0, PEL = P0 + nEye, NP = P0 + nEye + nEyeLo; // position-vertex count
log(`base ${NB} verts; kept ${P0} (+ eyes ${nEye} high, ${nEyeLo} low) = ${NP}`);

// output (render) vertices: unique (position vertex, uv) pairs
const outOrig: number[] = [], outUV: number[] = []; const key = new Map<string, number>();
const vid = (p: number, u: number, v: number) => { const k = `${p}:${u.toFixed(5)}:${v.toFixed(5)}`; let i = key.get(k); if (i === undefined) { i = outOrig.length; key.set(k, i); outOrig.push(p); outUV.push(u, v); } return i; };
const triBody: number[] = [], triLash: number[] = [], triMouth: number[] = [];
for (const f of obj.faces) {
  const isBody = f.g === 'body', isHelper = HELPERS.includes(f.g); if (!isBody && !isHelper) continue;
  const ids = f.v.map((b, j) => vid(pOfBase[b], obj.vt[f.t[j] * 2], obj.vt[f.t[j] * 2 + 1]));
  const dst = isBody ? triBody : f.g.includes('lash') ? triLash : triMouth;
  for (let j = 1; j + 1 < ids.length; j++) dst.push(ids[0], ids[j], ids[j + 1]);
}
const eyeTris = (o: typeof eyeObj, pBase: number, nv: number) => { const tris: number[] = [];
  for (const f of o.faces) { const ids = f.v.map((b, j) => vid(pBase + b, o.vt[f.t[j] * 2], o.vt[f.t[j] * 2 + 1])); for (let j = 1; j + 1 < ids.length; j++) tris.push(ids[0], ids[j], ids[j + 1]); }
  if (o.v.length / 3 !== nv) throw new Error('eye obj/mhclo mismatch'); return tris; };
const triEye = eyeTris(eyeObj, PE, nEye), triEyeLo = eyeTris(eyeLoObj, PEL, nEyeLo);
const NO = outOrig.length;
log(`render vertices ${NO}; body tris ${triBody.length / 3}, lashes ${triLash.length / 3}, mouth ${triMouth.length / 3}, eyes ${triEye.length / 3} / ${triEyeLo.length / 3}`);
if (NO > 65535) throw new Error('too many vertices for Uint16 indices');

// ---------------------------------------------------------------- weights: game-engine rig + face bones from the default rig
const GE_OF: Partial<Record<HBone, string>> = {}; for (const b of HBONES) if (rigGE[b]) GE_OF[b] = b;
const faceOf = (() => { // default-rig bone → face bone of ours (nearest ancestor), or null outside the head
  const map: Record<string, HBone | null> = {}; const direct: Record<string, HBone> = { head: 'head', jaw: 'jaw', 'eye.L': 'eye_l', 'eye.R': 'eye_r', 'orbicularis03.L': 'lid_ul', 'orbicularis04.L': 'lid_ll', 'orbicularis03.R': 'lid_ur', 'orbicularis04.R': 'lid_lr' };
  for (const b of Object.keys(skDef.bones)) { let p: string | null = b; while (p && !direct[p]) p = skDef.bones[p].parent; map[b] = p ? direct[p] : null; }
  return map;
})();
const W = Array.from({ length: NB }, () => new Map<number, number>());
for (const [b, list] of Object.entries(wGE)) { if (!(b in HB)) { if (list.length && b !== 'Root') throw new Error('unmapped GE bone ' + b); continue; } for (const [i, w] of list) W[i].set(HB[b as HBone], (W[i].get(HB[b as HBone]) ?? 0) + w); }
{ // split the GE head weight among head/jaw/eyes/lids by the default rig's face weights
  const face = Array.from({ length: NB }, () => new Map<number, number>());
  for (const [b, list] of Object.entries(wDef)) { const f = faceOf[b]; if (!f) continue; for (const [i, w] of list) face[i].set(HB[f], (face[i].get(HB[f]) ?? 0) + w); }
  let split = 0;
  for (let i = 0; i < NB; i++) { const h = W[i].get(HB.head); if (!h) continue; let s = 0; for (const w of face[i].values()) s += w; if (s < 1e-6) continue;
    W[i].delete(HB.head); for (const [b, w] of face[i]) W[i].set(b, (W[i].get(b) ?? 0) + h * w / s); split++; }
  log(`face split on ${split} head-weighted vertices`);
}
// top-4, normalised, quantised to bytes summing to 255
const skinIdx = new Uint8Array(NP * 4), skinW = new Uint8Array(NP * 4);
function packWeights(p: number, m: Map<number, number>) {
  const e = [...m.entries()].filter(([, w]) => w > 1e-5).sort((a, b) => b[1] - a[1]).slice(0, 4); const s = e.reduce((a, [, w]) => a + w, 0) || 1;
  const q = e.map(([, w]) => Math.round(w / s * 255)); let d = 255 - q.reduce((a, b) => a + b, 0); q[0] += d;
  e.forEach(([b], j) => { skinIdx[p * 4 + j] = b; skinW[p * 4 + j] = q[j]; });
  if (!e.length) { skinIdx[p * 4] = HB.head; skinW[p * 4] = 255; }
}
keep.forEach((b, p) => packWeights(p, W[b]));
const interpWeights = (clo: typeof eyeClo, pBase: number, n: number) => { for (let i = 0; i < n; i++) { const m = new Map<number, number>();
  for (let j = 0; j < 3; j++) for (const [b, w] of W[clo.refs[i * 3 + j]]) m.set(b, (m.get(b) ?? 0) + w * Math.abs(clo.w[i * 3 + j]));
  packWeights(pBase + i, m); } };
interpWeights(eyeClo, PE, nEye); interpWeights(eyeLoClo, PEL, nEyeLo);

// part ids from the dominant bone group
const partOfBone = (b: HBone): number => {
  if (['head', 'jaw', 'eye_l', 'eye_r', 'lid_ul', 'lid_ll', 'lid_ur', 'lid_lr'].includes(b)) return PART.head;
  if (b === 'neck_01') return PART.neck; if (b === 'spine_03' || b.startsWith('clavicle')) return PART.chest; if (b === 'spine_01' || b === 'spine_02') return PART.belly; if (b === 'pelvis') return PART.pelvis;
  const s = b.endsWith('_l') ? 'l' : 'r';
  if (b.startsWith('upperarm')) return PART[`uarm_${s}`]; if (b.startsWith('lowerarm')) return PART[`farm_${s}`]; if (b.startsWith('thigh')) return PART[`thigh_${s}`];
  if (b.startsWith('calf')) return PART[`calf_${s}`]; if (b.startsWith('foot') || b.startsWith('ball')) return PART[`foot_${s}`];
  return PART[`hand_${s}`];
};
const part = new Uint8Array(NP);
for (let p = 0; p < NP; p++) part[p] = partOfBone(HBONES[skinIdx[p * 4]] as HBone);
keep.forEach((b, p) => { for (const g of HELPERS) if (range(g).includes(b)) part[p] = g.includes('lash') ? PART.lash : helperPart[g]; });
for (let p = PE; p < NP; p++) part[p] = PART.eye;

// ---------------------------------------------------------------- morph + joints + re-pose, per variant
const targetCache = new Map<string, Target | null>();
async function target(path: string) { if (!targetCache.has(path)) { const b = await mhTry(path); targetCache.set(path, b ? parseTarget(b.toString()) : null); } return targetCache.get(path)!; }
const jointCube: Record<HBone, [string, string]> = {} as any; // bone head cube, tail cube
for (const b of HBONES) if (rigGE[b]) jointCube[b] = [rigGE[b].head.cube_name, rigGE[b].tail.cube_name];
const DJ = skDef.joints as Record<string, number[]>;

interface Built { pos: Float64Array; joints: number[][]; tails: number[][]; face: Record<string, number>; macro: Macro; height: number }
async function buildVariant(d: VDef): Promise<Built> {
  const r = rnd(d.seed);
  const macro: Macro = { gender: d.sex === 'm' ? 1 : 0, age: ageYearsToValue(d.age), muscle: d.muscle, weight: d.weight, height: d.height, proportions: d.prop, blend: d.blend };
  const pos = Float64Array.from(obj.v);
  let missing = 0;
  for (const [p, w] of macroTargets(macro)) { const t = await target(p); if (t) applyTarget(pos, t, w); else missing++; }
  if (missing) log(`  ${d.id}: ${missing} macro targets missing (skipped)`);
  const face: Record<string, number> = {};
  const faceK = d.age < 14 ? 0.5 : 1;
  for (const [g, n, pair, lo, hi] of FACE) { const v = +(faceK * (lo + (hi - lo) * r())).toFixed(3); face[n] = v;
    for (const nn of [n, MIRROR[n]].filter(Boolean)) { const [p, w] = modifierTarget(g, nn, v, pair); const t = await target(p); if (t) applyTarget(pos, t, w); } }
  // dm → m, ground at y = 0
  const g0 = cubeMean(pos, 'joint-ground')[1];
  for (let i = 0; i < NB; i++) { pos[i * 3] *= 0.1; pos[i * 3 + 1] = (pos[i * 3 + 1] - g0) * 0.1; pos[i * 3 + 2] *= 0.1; }
  const joints: number[][] = [], tails: number[][] = [];
  for (const b of HBONES) {
    if (jointCube[b]) { joints.push(cubeMean(pos, jointCube[b][0])); tails.push(cubeMean(pos, jointCube[b][1])); continue; }
    const def = { jaw: 'jaw', eye_l: 'eye.L', eye_r: 'eye.R', lid_ul: 'orbicularis03.L', lid_ll: 'orbicularis04.L', lid_ur: 'orbicularis03.R', lid_lr: 'orbicularis04.R' }[b as string]!;
    joints.push(listMean(pos, DJ[`${def}____head`])); tails.push(listMean(pos, DJ[`${def}____tail`]));
  }
  // eyes: fit the proxies to the morphed helper geometry
  const eye = fitMhclo(eyeClo, pos), eyeLo = fitMhclo(eyeLoClo, pos);
  const all = new Float64Array(NP * 3);
  keep.forEach((b, p) => { all[p * 3] = pos[b * 3]; all[p * 3 + 1] = pos[b * 3 + 1]; all[p * 3 + 2] = pos[b * 3 + 2]; });
  all.set(eye, PE * 3); all.set(eyeLo, PEL * 3);
  const posed = repose(all, joints, tails);
  let top = 0; for (let p = 0; p < 13380; p++) top = Math.max(top, posed.pos[p * 3 + 1]);
  return { pos: posed.pos, joints: posed.joints, tails: posed.tails, face, macro, height: top };
}

// quaternion helpers (x, y, z, w)
type Q = [number, number, number, number]; type V3 = number[];
const qMul = (a: Q, b: Q): Q => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qInv = (a: Q): Q => [-a[0], -a[1], -a[2], a[3]];
const qRot = (q: Q, v: V3): V3 => { const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), qInv(q)); return [p[0], p[1], p[2]]; };
const norm = (v: V3) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a: V3, b: V3) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const qFromTo = (a: V3, b: V3): Q => { a = norm(a); b = norm(b); const c = cross(a, b), d = dot(a, b); if (d < -0.999999) return [1, 0, 0, 0]; const q: Q = [c[0], c[1], c[2], 1 + d]; const l = Math.hypot(...q); return q.map(x => x / l) as Q; };
const qAxis = (ax: V3, ang: number): Q => { const s = Math.sin(ang / 2); ax = norm(ax); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };

/** bind-pose re-pose (LBS with the merged weights): upper arms to hanging (6° abduction), elbows 10° flexed,
 *  palms toward the thighs; thighs adducted so each ankle is under its hip joint. Bones keep identity orientation. */
function repose(pos: Float64Array, joints: number[][], tails: number[][]) {
  const nb = HBONES.length; const world: Q[] = Array.from({ length: nb }, () => [0, 0, 0, 1] as Q); const local: Q[] = world.map(() => [0, 0, 0, 1] as Q);
  const J = (b: HBone) => joints[HB[b]];
  for (const s of ['l', 'r'] as const) {
    const sg = s === 'l' ? 1 : -1;
    const sh = J(`upperarm_${s}`), el = J(`lowerarm_${s}`), wr = J(`hand_${s}`);
    const tU = norm([sg * Math.sin(6 * Math.PI / 180), -1, -0.02]);
    const qU = qFromTo(sub(el, sh), tU);
    const dF = qRot(qU, sub(wr, el)); const tF = norm([tU[0] * 0.6, tU[1], 0.18]);
    let qFw = qMul(qFromTo(dF, tF), qU); // lowerarm world rotation
    // palm: normal of (wrist, index knuckle, pinky knuckle) after rotation should face medially and a little back
    const idx = qRot(qFw, sub(J(`index_01_${s}`), wr)), pin = qRot(qFw, sub(J(`pinky_01_${s}`), wr));
    let n = norm(cross(idx, pin)); if (s === 'l') n = n.map(x => -x); // palm-side normal
    const want = norm([-sg, 0, -0.25]); // medial, slightly backward
    const ax = norm(tF); const proj = (v: V3) => norm(sub(v, ax.map(x => x * dot(v, ax))));
    const a = proj(n), bb = proj(want); let ang = Math.acos(Math.max(-1, Math.min(1, dot(a, bb)))); if (dot(cross(a, bb), ax) < 0) ang = -ang;
    qFw = qMul(qAxis(ax, ang * 0.85), qFw); // most of the twist in the forearm (the wrist keeps the rest)
    world[HB[`upperarm_${s}`]] = qU; local[HB[`upperarm_${s}`]] = qU;
    local[HB[`lowerarm_${s}`]] = qMul(qInv(qU), qFw);
    const hip = J(`thigh_${s}`), ank = J(`foot_${s}`);
    const qT = qFromTo(sub(ank, hip), norm([sg * 0.012, -1, 0.0]));
    local[HB[`thigh_${s}`]] = qT;
  }
  // forward kinematics: world rotation and position of each bone head
  const wq: Q[] = [], wp: V3[] = [];
  HBONES.forEach((b, i) => { const p = HPARENT[b]; if (!p) { wq[i] = local[i]; wp[i] = joints[i]; return; }
    const pi = HB[p]; wq[i] = qMul(wq[pi], local[i]); wp[i] = [0, 1, 2].map(k => wp[pi][k]).map((x, k) => x + qRot(wq[pi], sub(joints[i], joints[pi]))[k]); });
  const out = new Float64Array(pos.length);
  for (let p = 0; p < NP; p++) {
    const v = [pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2]]; const acc = [0, 0, 0];
    for (let j = 0; j < 4; j++) { const w = skinW[p * 4 + j] / 255; if (!w) continue; const b = skinIdx[p * 4 + j];
      const r = qRot(wq[b], sub(v, joints[b])); for (let k = 0; k < 3; k++) acc[k] += w * (wp[b][k] + r[k]); }
    out.set(acc, p * 3);
  }
  const tl = tails.map((t, i) => { const r = qRot(wq[i], sub(t, joints[i])); return [0, 1, 2].map(k => wp[i][k] + r[k]); });
  return { pos: out, joints: wp, tails: tl };
}

// ---------------------------------------------------------------- build all variants
const built = new Map<string, Built>();
for (const d of V) { built.set(d.id, await buildVariant(d)); log(`variant ${d.id}: height ${built.get(d.id)!.height.toFixed(3)} m`); }
const ref = built.get(REF)!;

// ---------------------------------------------------------------- LODs (index-only simplification on the reference body)
await MeshoptSimplifier.ready;
const refPosOut = new Float32Array(NO * 3); for (let i = 0; i < NO; i++) for (let k = 0; k < 3; k++) refPosOut[i * 3 + k] = ref.pos[outOrig[i] * 3 + k];
const uvAttr = new Float32Array(NO * 2); for (let i = 0; i < NO * 2; i++) uvAttr[i] = outUV[i];
function simplify(tris: number[], targetTris: number, uvWeight: number) {
  const idx = new Uint32Array(tris);
  const [res, err] = MeshoptSimplifier.simplifyWithAttributes(idx, refPosOut, 3, uvAttr, 2, [uvWeight, uvWeight], null, targetTris * 3, 0.05, 0);
  log(`  simplified ${tris.length / 3} → ${res.length / 3} tris (error ${(err * 100).toFixed(2)} %)`);
  return Array.from(res as Uint32Array) as number[];
}
const lod1Body = simplify(triBody, 5200, 0.5), lod2Body = simplify(triBody, 1100, 0.2);
const LOD0: number[] = [...triBody, ...triLash, ...triMouth, ...triEye], LOD1: number[] = [...lod1Body, ...triEyeLo], LOD2: number[] = [...lod2Body, ...triEyeLo];

// ---------------------------------------------------------------- finger curl axes (bind pose of the reference body)
const curlAxes: Record<string, number[]> = {};
for (const s of ['l', 'r'] as const) {
  const J = (b: string) => ref.joints[HB[b as HBone]];
  const wr = J(`hand_${s}`), palmN = norm(cross(sub(J(`index_01_${s}`), wr), sub(J(`pinky_01_${s}`), wr))).map(x => s === 'l' ? -x : x); // palm normal (toward the palm side)
  for (const f of FINGERS) for (const k of ['01', '02', '03']) {
    const b = `${f}_${k}_${s}` as HBone; const dir = norm(sub(ref.tails[HB[b]], ref.joints[HB[b]]));
    // curl moves the finger tip toward the palm: axis = dir × palmN (thumb: across the palm)
    let ax = norm(cross(dir, f === 'thumb' ? sub(J(`pinky_01_${s}`), J(`index_01_${s}`)).map(x => -x) : palmN));
    curlAxes[b] = ax.map(x => +x.toFixed(4));
  }
}

// ---------------------------------------------------------------- landmarks (reference topology)
const landmarks: Record<string, number> = {};
{
  const head = HB.head, P = ref.pos; let top = -1, nose = -1, chin = -1;
  const eyeY = (ref.joints[HB.eye_l][1] + ref.joints[HB.eye_r][1]) / 2, jawY = ref.joints[HB.jaw][1];
  for (let p = 0; p < 13380; p++) { if (part[p] !== PART.head) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
    if (top < 0 || y > P[top * 3 + 1]) top = p;
    if (Math.abs(x) < 0.004 && y < eyeY && y > jawY - 0.01 && (nose < 0 || z > P[nose * 3 + 2])) nose = p; }
  for (let p = 0; p < 13380; p++) { if (part[p] !== PART.head) continue; const x = P[p * 3], y = P[p * 3 + 1], z = P[p * 3 + 2];
    if (Math.abs(x) < 0.004 && z > P[nose * 3 + 2] - 0.06 && (chin < 0 || y < P[chin * 3 + 1])) chin = p; }
  Object.assign(landmarks, { head_top: top, nose_tip: nose, chin }); void head;
}
log('landmarks', JSON.stringify(landmarks));

// ---------------------------------------------------------------- cavity occlusion, masks, textures
const refN = new Float64Array(NP * 3);
for (let t = 0; t < LOD0.length; t += 3) { const a = outOrig[LOD0[t]] * 3, b = outOrig[LOD0[t + 1]] * 3, c = outOrig[LOD0[t + 2]] * 3, P = ref.pos;
  const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]], n = cross(u, v);
  for (const i of [a, b, c]) for (let k = 0; k < 3; k++) refN[i + k] += n[k]; }
for (let i = 0; i < NP; i++) { const l = Math.hypot(refN[i * 3], refN[i * 3 + 1], refN[i * 3 + 2]) || 1; for (let k = 0; k < 3; k++) refN[i * 3 + k] /= l; }
const ao = cavityAO(ref.pos, refN, [...triBody, ...triEye], outOrig, NP); // lashes and mouth helpers are not occluders
log(`cavity occlusion: mean ${(ao.reduce((a, b) => a + b, 0) / NP).toFixed(3)}, min ${Math.min(...ao).toFixed(3)}`);
mkdirSync(OUT, { recursive: true });
const baked = bakeSkin({ W: 1024, H: 1024, pos: ref.pos, orig: outOrig, uv: outUV, tris: triBody, part, joints: ref.joints, tails: ref.tails, landmarks, bone: HB, ao });
writeFileSync(`${OUT}/skin.png`, encodePNG(1024, 1024, baked.skin, 4));
writeFileSync(`${OUT}/hair.png`, encodePNG(512, 512, baked.hair, 4));
const masks = vertexMasks(baked.frame, ref.pos, refN, part, NP);
const eyeSmall = downscale(eyeTex, Math.max(1, Math.round(eyeTex.width / 256)));
writeFileSync(`${OUT}/eye.png`, encodePNG(eyeSmall.width, eyeSmall.height, eyeSmall.data, 4));
const face = { eyeY: baked.frame.eyeY, mouthY: baked.frame.mouth[1], lipZ: baked.frame.lipZ, halfW: baked.frame.halfW, backZ: baked.frame.backZ, topY: baked.frame.topY, noseY: baked.frame.nose[1], chinY: baked.frame.chin[1] };
log('face frame (ref)', JSON.stringify(face, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v));

// ---------------------------------------------------------------- write binary + json
const chunks: Buffer[] = []; let off = 0; const layout: HumanAssetsMeta['layout'] = {};
const add = (name: string, arr: ArrayBufferView & { length: number }, type: HumanAssetsMeta['layout'][string]['type'], itemSize: number) => {
  const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4;
  layout[name] = { offset: off, count: arr.length / itemSize, type, itemSize }; chunks.push(b, Buffer.alloc(pad)); off += b.length + pad; return layout[name].offset; };
add('orig', Uint16Array.from(outOrig), 'u16', 1);
add('uv', Uint16Array.from(outUV.map(x => Math.round(Math.min(1, Math.max(0, x)) * 65535))), 'u16', 2);
add('skinIndex', skinIdx, 'u8', 4); add('skinWeight', skinW, 'u8', 4); add('part', part, 'u8', 1);
add('ao', Uint8Array.from(ao, x => Math.round(x * 255)), 'u8', 1); add('beard', masks.beard, 'u8', 1); add('scalp', masks.scalp, 'u8', 1);
add('lod0', Uint16Array.from(LOD0), 'u16', 3); add('lod1', Uint16Array.from(LOD1), 'u16', 3); add('lod2', Uint16Array.from(LOD2), 'u16', 3);
const POS_SCALE = 1e-4;
const variants: HumanVariantMeta[] = V.map(d => {
  const b = built.get(d.id)!; const q = new Int16Array(NP * 3); for (let i = 0; i < NP * 3; i++) q[i] = Math.round(b.pos[i] / POS_SCALE);
  const o = add(`pos_${d.id}`, q, 'i16', 3);
  const group = d.age < 14 ? 'child' : d.age >= 50 ? 'elder' : 'adult';
  return { id: d.id, label: `${d.sex === 'm' ? (group === 'child' ? 'boy' : 'man') : group === 'child' ? 'girl' : 'woman'}, ~${d.age} y, build ${d.muscle.toFixed(2)}/${d.weight.toFixed(2)}, variant blend ${d.blend.join('/')}`,
    sex: d.sex, ageYears: d.age, group, macro: b.macro, face: b.face, height: +b.height.toFixed(4), joints: b.joints.map(j => j.map(x => +x.toFixed(5))), posOffset: o, tier: 'C',
    note: 'MakeHuman CC0 base mesh morphed by its macro targets (sex, age, muscle, weight, height, proportions) and a seeded set of face targets; the population-morph blend is used only for variety (not an ethnic claim)' };
});
const meta: HumanAssetsMeta = {
  version: 1, generated: new Date().toISOString().slice(0, 10), units: 'm', posScale: POS_SCALE,
  source: [
    { name: 'MakeHuman 1.x base mesh hm08, macro/face targets, default rig + weights, eye proxies + brown eye texture', url: 'https://github.com/makehumancommunity/makehuman (makehuman/data)', licence: 'CC0 1.0 (LICENSE.md §C: assets)', credit: 'MakeHuman team' },
    { name: 'MPFB2 game-engine rig + weights, base-mesh vertex groups', url: 'https://github.com/makehumancommunity/mpfb2 (src/mpfb/data)', licence: 'CC0 1.0 (LICENSE.md §C: assets)', credit: 'MakeHuman team' },
  ],
  bones: [...HBONES], parents: HBONES.map(b => (HPARENT[b] ? HB[HPARENT[b]!] : -1)),
  vertexCount: NO, bodyVertexCount: P0,
  layout, lods: [{ name: 'full', indexKey: 'lod0', triangles: LOD0.length / 3 }, { name: 'mid', indexKey: 'lod1', triangles: LOD1.length / 3 }, { name: 'far', indexKey: 'lod2', triangles: LOD2.length / 3 }],
  landmarks, curlAxes, variants,
  textures: { skin: { file: 'skin.png', width: 1024, height: 1024, note: 'skin albedo of a reference tone, baked from 3-D procedural functions on the reference body (C); alpha = eyebrow density' },
    hair: { file: 'hair.png', width: 512, height: 512, note: 'R beard density, G scalp hair density, B cavity occlusion (C)' },
    eye: { file: 'eye.png', width: eyeSmall.width, height: eyeSmall.height, note: 'MakeHuman brown_eye.png (CC0), downscaled' } },
};
writeFileSync(`${OUT}/humans.bin`, Buffer.concat(chunks));
writeFileSync(`${OUT}/humans.json`, JSON.stringify(meta));
log(`wrote ${OUT}: bin ${(off / 1e6).toFixed(2)} MB, ${V.length} variants, LOD tris ${meta.lods.map(l => l.triangles).join(' / ')}`);

// ---------------------------------------------------------------- previews (verification images)
if (PREVIEW) {
  mkdirSync('shots', { recursive: true });
  const col = (p: number): [number, number, number] => [[230, 190, 160], [200, 170, 150], [120, 170, 90], [90, 150, 90], [70, 120, 160], [200, 120, 80], [220, 150, 90], [240, 200, 120], [200, 120, 80], [220, 150, 90], [240, 200, 120],
    [150, 110, 200], [120, 90, 180], [90, 70, 150], [150, 110, 200], [120, 90, 180], [90, 70, 150], [40, 40, 40], [250, 250, 240], [200, 90, 90], [20, 20, 20]][p] as [number, number, number];
  for (const id of ['m03', 'm14', 'f02', 'c01']) {
    const b = built.get(id)!; const pos = new Float32Array(NO * 3); for (let i = 0; i < NO; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = b.pos[outOrig[i] * 3 + k];
    for (const view of ['front', 'side'] as const) {
      const img = preview([{ pos, index: LOD0, color: t => col(part[outOrig[LOD0[t * 3]]]) }], view, 400, 800, { cx: 0, cy: 0.9, half: 0.5 });
      writeFileSync(`shots/humans_${id}_${view}.png`, encodePNG(400, 800, img, 4));
    }
    const hy = b.joints[HB.head][1] + 0.05;
    const tex = { w: 1024, h: 1024, data: baked.skin }, hairT = { w: 512, h: 512, data: baked.hair };
    const bodyT = (t: number) => part[outOrig[LOD0[t * 3]]] < PART.eye;
    for (const [nm, T] of [['face', tex], ['facemask', hairT]] as const)
      for (const view of ['front', 'side'] as const) {
        const img = preview([{ pos, index: LOD0, uv: uvAttr, tex: T, texTri: bodyT, color: t => col(part[outOrig[LOD0[t * 3]]]) }], view, 400, 400, { cx: view === 'side' ? -b.joints[HB.head][2] - 0.02 : 0, cy: hy, half: 0.14 });
        writeFileSync(`shots/humans_${id}_${nm}_${view}.png`, encodePNG(400, 400, img, 4));
      }
  }
  for (const [n, L] of [['lod1', LOD1], ['lod2', LOD2]] as [string, number[]][]) {
    const img = preview([{ pos: refPosOut, index: L, color: t => col(part[outOrig[L[t * 3]]]) }], 'front', 400, 800, { cx: 0, cy: 0.9, half: 0.5 });
    writeFileSync(`shots/humans_${REF}_${n}.png`, encodePNG(400, 800, img, 4));
  }
  log('previews → shots/humans_*.png');
}
