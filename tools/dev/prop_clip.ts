// dev (s18 C5, D-691): carried and held props against the bodies that carry them, over every activity and variant that
// holds one. The body skinned by the rig at 8 phases of the cycle (the crowd's pose call), the prop placed by placeProp,
// the prop's surface sampled (vertices, edge midpoints, triangle centres); a sample is inside the body when it lies under
// the skin along the nearest body vertex's normal (within 15 cm of it). The holding hands and fingers are not counted
// (a grip closes round its handle), nor the forearm that bears a basket on the hip or a tool along it.
// Prints per prop and act the deepest point inside the body (cm) and the part; `--max cm` exits 1 when any is deeper.
// Also the goods in the plan's words (popview propOf: basket, sack, jar, head jar, tablet) under the act's own pose.
// Usage: npx tsx tools/dev/prop_clip.ts [--max 3] [--only act]
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { PART } from '../../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, skinPoint } from '../../src/people/humanRig';
import { pose, type AnimId } from '../../src/people/anim';
import { placeProp, propGeometry, PROPS, setDown, GOODS_POSES, CARRY_POSE } from '../../src/people/props';
import { ACTIVITIES, type ActivityId } from '../../src/people/activities';
import { lookFor } from '../../src/people/looks';

const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const MAX = flag('--max', 1e9) / 100, ONLY = argv.indexOf('--only') >= 0 ? argv[argv.indexOf('--only') + 1] : null;
const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const NAME = Object.fromEntries(Object.entries(PART).map(([n, i]) => [i, n]));
const bodies: [string, number, string][] = [];
for (const [sex, dress, role] of [['m', 'worker', 'porter'], ['f', 'woman', 'porter']] as const) { const L = lookFor(A, { id: 3, sex, role, dress, seed: 103, age: 'adult' } as any, 1); bodies.push([L.variantId, L.scale, sex]); }
const tris = A.lods[0];
/** the skinned body (scaled character space): positions, normals, parts, an 8 cm grid of vertex indices */
function body(variant: string, scale: number, anim: AnimId, ph: number) {
  const v = A.byId[variant], rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), po = pose(anim, 1, ph, 0.3);
  const inp: any = { joints: v.joints, pose: po, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: po.grip ?? [0.15, 1], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true };
  rig.setPose(inp); rig.solve(inp, pal, 0);
  const P = new Float32Array(A.NO * 3), N = new Float32Array(A.NO * 3), o = [0, 0, 0];
  for (let i = 0; i < A.NO; i++) { skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o); P[i * 3] = o[0] * scale; P[i * 3 + 1] = o[1] * scale; P[i * 3 + 2] = o[2] * scale; }
  for (let t = 0; t < tris.length; t += 3) { const a = tris[t] * 3, b2 = tris[t + 1] * 3, c = tris[t + 2] * 3;
    const ux = P[b2] - P[a], uy = P[b2 + 1] - P[a + 1], uz = P[b2 + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; for (const k of [a, b2, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; } }
  const G = new Map<number, number[]>(), key = (x: number, y: number, z: number) => (Math.floor(x / 0.08) + 500) * 1e6 + (Math.floor(y / 0.08) + 500) * 1e3 + (Math.floor(z / 0.08) + 500);
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt >= PART.eye) continue; const L = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= L; N[i * 3 + 1] /= L; N[i * 3 + 2] /= L;
    const k = key(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); const l = G.get(k); if (l) l.push(i); else G.set(k, [i]); }
  return { rig, po, P, N, G, key };
}
/** sample points of a prop geometry (its own space) */
const SAMPLES = new Map<string, Float32Array>();
function samples(kind: string): Float32Array | null {
  const geom = PROPS[kind]?.geom ?? kind; let s = SAMPLES.get(geom); if (s) return s;
  const g = propGeometry(geom); if (!g) return null; const p = g.getAttribute('position'), idx = g.index, out: number[] = [];
  const n = idx ? idx.count : p.count, at = (i: number) => (idx ? idx.getX(i) : i);
  for (let t = 0; t + 2 < n; t += 3) { const a = at(t), b2 = at(t + 1), c = at(t + 2);
    for (const [wa, wb, wc] of [[1, 0, 0], [0.5, 0.5, 0], [0.33, 0.33, 0.34], [0, 0.5, 0.5], [0.5, 0, 0.5]]) out.push(p.getX(a) * wa + p.getX(b2) * wb + p.getX(c) * wc, p.getY(a) * wa + p.getY(b2) * wb + p.getY(c) * wc, p.getZ(a) * wa + p.getZ(b2) * wb + p.getZ(c) * wc); }
  s = new Float32Array(out); SAMPLES.set(geom, s); return s;
}
/** parts a prop may meet by its rule: the hands that hold it (and the forearm of a hip basket) */
function allowed(kind: string): Set<number> {
  const P = PROPS[kind] ?? { rule: 'legacy' } as any, s = new Set<number>([PART.hand_l, PART.hand_r]);
  if (P.rule === 'hip') s.add(PART.farm_l);
  return s;
}
function deepest(kind: string, variant: string, scale: number, anim: AnimId, slot: 0 | 1) {
  let worst = 0, part = '', at = 0;
  for (let ph = 0; ph < 8; ph++) { const B = body(variant, scale, anim, (ph / 8) * Math.PI * 2), M = new THREE.Matrix4();
    // (as crowd.ts posePerson: goods held in a pose not made for them are set down)
    const down = !!GOODS_POSES[kind] && !GOODS_POSES[kind].includes(anim);
    if (!(down ? setDown(PROPS[kind]?.geom ?? kind, B.rig as any, scale, M) : placeProp(kind, B.rig as any, B.po, scale, 1, slot, M))) continue; const S = samples(kind); if (!S) return null;
    const ok = allowed(kind), q = new THREE.Vector3();
    for (let i = 0; i < S.length; i += 3) { q.set(S[i], S[i + 1], S[i + 2]).applyMatrix4(M);
      let bd = 0.15, bi = -1; const cx = Math.floor(q.x / 0.08), cy = Math.floor(q.y / 0.08), cz = Math.floor(q.z / 0.08);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const L = B.G.get((cx + dx + 500) * 1e6 + (cy + dy + 500) * 1e3 + (cz + dz + 500)); if (!L) continue;
        for (const j of L) { const d = Math.hypot(B.P[j * 3] - q.x, B.P[j * 3 + 1] - q.y, B.P[j * 3 + 2] - q.z); if (d < bd) { bd = d; bi = j; } } }
      if (bi < 0 || ok.has(A.part[bi])) continue;
      const d = (q.x - B.P[bi * 3]) * B.N[bi * 3] + (q.y - B.P[bi * 3 + 1]) * B.N[bi * 3 + 1] + (q.z - B.P[bi * 3 + 2]) * B.N[bi * 3 + 2];
      if (-d > worst) { worst = -d; part = NAME[A.part[bi]]; at = ph; if (process.env.PCDBG) console.log(kind, anim, "local", S[i].toFixed(2), S[i + 1].toFixed(2), S[i + 2].toFixed(2), "depth", (-d * 100).toFixed(1)); } } }
  return { worst, part, at };
}
// every (act, variant) that holds a prop
const rows: { k: string; d: number; line: string }[] = [];
for (const [act, P] of Object.entries(ACTIVITIES) as [ActivityId, any][]) {
  if (ONLY && act !== ONLY) continue;
  const perfs = [{ v: -1, anim: P.anim, prop: P.prop, prop2: P.prop2, note: '' }, ...(P.variants ?? []).map((v: any, i: number) => ({ v: i, anim: v.anim ?? P.anim, prop: 'prop' in v ? v.prop : P.prop, prop2: 'prop2' in v ? v.prop2 : P.prop2, note: v.note ?? '' }))];
  const seen = new Set<string>();
  for (const f of perfs) for (const [slot, kind] of [[0, f.prop], [1, f.prop2]] as [0 | 1, string | undefined][]) { if (!kind) continue; const id = `${f.anim}|${kind}|${slot}`; if (seen.has(id)) continue; seen.add(id);
    let worst = 0, part = '', who = '';
    for (const [vid, sc, sex] of bodies) { const r = deepest(kind, vid, sc, f.anim, slot); if (!r) continue; if (r.worst > worst) { worst = r.worst; part = r.part; who = `${sex} phase ${r.at}`; } }
    rows.push({ k: `${act}${f.v >= 0 ? `#${f.v}` : ''}`, d: worst, line: `${(worst * 100).toFixed(1).padStart(5)} cm  ${kind.padEnd(12)} ${act}${f.v >= 0 ? `#${f.v}` : ''} (${f.anim})${worst > 0.01 ? ` in the ${part}, ${who}` : ''}` }); } }
// goods in the plan's words (popview propOf) with the act's own pose: walking (crowd.ts gives the carrying pose), standing,
// talking, sitting, eating
if (!ONLY) for (const kind of ['basket', 'sack', 'jar', 'jar_head', 'tablet']) for (const anim0 of ['walk', 'idle', 'talk', 'sit', 'eat', 'rest'] as AnimId[]) {
  const anim = (anim0 === 'walk' && CARRY_POSE[kind] ? CARRY_POSE[kind] : anim0) as AnimId; let worst = 0, part = '', who = '';
  for (const [vid, sc, sex] of bodies) { const r = deepest(kind, vid, sc, anim, 0); if (!r) continue; if (r.worst > worst) { worst = r.worst; part = r.part; who = `${sex} phase ${r.at}`; } }
  rows.push({ k: `goods:${kind}:${anim0}`, d: worst, line: `${(worst * 100).toFixed(1).padStart(5)} cm  ${kind.padEnd(12)} goods while ${anim0} (${anim})${worst > 0.01 ? ` in the ${part}, ${who}` : ''}` }); }
rows.sort((a, b) => b.d - a.d); for (const r of rows) console.log(r.line);
const bad = rows.filter(r => r.d > MAX); console.log(`${rows.length} held props over ${bodies.length} bodies × 8 phases; deeper than 3 cm: ${rows.filter(r => r.d > 0.03).length}, than 6 cm: ${rows.filter(r => r.d > 0.06).length}`);
process.exit(bad.length ? 1 : 0);
