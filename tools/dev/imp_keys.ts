// dev (D-229): how well each animation is represented by the impostor frames. For every animation the cycle is sampled
// (60 s at 0.1 s, the bake's k = 0.4) on the working man's reference body; a pose is the character-space positions of
// 13 bone heads (impostors.ts POSE_BONES). Per animation: the 1-medoid of the cycle (the single pose that best stands
// for it: least mean distance to all samples) and its spread, the 2-medoids and their spread (how much a second frame
// adds), and the frames of the atlas that stand for it (impostors.ts frameOf) with the cycle's mean distance to them.
// --cover: a greedy frame set from the candidates (the atlas's frames and every animation's medoids): each animation's
// best single frame must be within TOL of its cycle; the swing cycles (spread ≥ SWING and a second frame halving it)
// named with --pairs=a,b take their 2-medoids (alternated on the cycle). --tol=0.09 (m).
// Usage: npx tsx tools/dev/imp_keys.ts [--cover] [anim ...]
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE } from '../../src/people/humanRig';
import { ANIMS, type AnimId } from '../../src/people/anim';
import { FRAMES, poseRig, poseDist, framePoseOf, IMP_GAITS, framesOf } from '../../src/people/impostors';

const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const cand = A.variants.filter(v => v.meta.sex === 'm' && v.meta.group === 'adult'), v = cand.reduce((a, x) => Math.abs(x.height - 1.66) < Math.abs(a.height - 1.66) ? x : a);
const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
const cover = process.argv.includes('--cover'), only = process.argv.slice(2).filter(x => !x.startsWith('--')), list = (only.length ? only : ANIMS) as AnimId[];
const arg = (k: string) => process.argv.find(x => x.startsWith(`--${k}=`))?.split('=')[1];
const TOL = +(arg('tol') ?? 0.09), T = 60, dt = 0.1, PAIRS = new Set((arg('pairs') ?? '').split(',').filter(Boolean));
const frameF = FRAMES.map(F => framePoseOf(rig, pal, v.joints, F));
type Rec = { anim: AnimId; S: Float64Array[]; ts: number[]; m1: number; s1: number; a: number; c: number; s2: number };
const recs: Rec[] = [];
for (const anim of list) {
  const S: Float64Array[] = [], ts: number[] = []; for (let t = 0; t < T - 1e-9; t += dt) { S.push(poseRig(rig, pal, v.joints, anim, t, 2 * Math.PI * t / 1.1)); ts.push(+t.toFixed(2)); }
  const n = S.length, D = new Float32Array(n * n); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i * n + j] = D[j * n + i] = poseDist(S[i], S[j]);
  let m1 = 0, s1 = Infinity; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += D[i * n + j]; if (s < s1) { s1 = s; m1 = i; } } s1 /= n;
  let a = m1, c = 0; for (let j = 0; j < n; j++) if (D[m1 * n + j] > D[m1 * n + c]) c = j;
  const cost = (x: number, y: number) => { let s = 0; for (let j = 0; j < n; j++) s += Math.min(D[x * n + j], D[y * n + j]); return s / n; };
  let s2 = cost(a, c); for (let it = 0; it < 10; it++) { let best = s2, ba = a, bc = c; for (let i = 0; i < n; i++) { const x = cost(i, c); if (x < best) { best = x; ba = i; bc = c; } const y = cost(a, i); if (y < best) { best = y; ba = a; bc = i; } } if (best >= s2 - 1e-9) break; s2 = best; a = ba; c = bc; }
  recs.push({ anim, S, ts, m1, s1, a, c, s2 });
  const mean = (f: Float64Array) => r.S.reduce((s, x) => s + poseDist(f, x), 0) / n, r = recs[recs.length - 1];
  const fr = framesOf(anim), fd = fr.length === 1 ? mean(frameF[fr[0]]) : S.reduce((s, x) => s + Math.min(...fr.map(i => poseDist(frameF[i], x))), 0) / n;
  const near = frameF.map((f, i) => ({ id: FRAMES[i].id, d: mean(f) })).sort((x, y) => x.d - y.d);
  console.log(`${anim.padEnd(14)} 1-medoid t=${ts[m1].toFixed(1)} spread ${s1.toFixed(3)} | 2-medoids t=${ts[a].toFixed(1)}/${ts[c].toFixed(1)} spread ${s2.toFixed(3)} | frameOf ${fr.map(i => FRAMES[i].id).join('/')} ${fd.toFixed(3)}${IMP_GAITS.has(anim) ? ' (gait)' : ''} | nearest ${near.slice(0, 3).map(x => `${x.id} ${x.d.toFixed(3)}`).join(', ')}`);
}
if (cover) {
  const R = recs.filter(r => !IMP_GAITS.has(r.anim) && r.anim !== 'carry_head' && r.anim !== 'carry_shoulder');
  type C = { id: string; anim: AnimId; t: number; f: Float64Array };
  const C: C[] = [];
  for (const r of R) { C.push({ id: `${r.anim}@${r.ts[r.m1]}`, anim: r.anim, t: r.ts[r.m1], f: r.S[r.m1] }); }
  const md = (f: Float64Array, r: Rec) => r.S.reduce((s, x) => s + poseDist(f, x), 0) / r.S.length;
  const base = frameF.map((f, i) => ({ id: FRAMES[i].id, f }));
  const swing = R.filter(r => PAIRS.has(r.anim));
  const chosen: { id: string; f: Float64Array }[] = [...base];
  const coveredBy = (r: Rec) => Math.min(...chosen.map(c => md(c.f, r)));
  for (const r of swing) { chosen.push({ id: `${r.anim}@${r.ts[r.a]}`, f: r.S[r.a] }, { id: `${r.anim}@${r.ts[r.c]}`, f: r.S[r.c] }); }
  let left = R.filter(r => !swing.includes(r) && coveredBy(r) > TOL);
  while (left.length) { let best: C | null = null, bn = 0, bs = Infinity;
    for (const c of C) { const hit = left.filter(r => md(c.f, r) <= TOL); const s = hit.reduce((x, r) => x + md(c.f, r), 0); if (hit.length > bn || (hit.length === bn && s < bs)) { best = c; bn = hit.length; bs = s; } }
    if (!best || !bn) break; chosen.push(best); console.log(`+ ${best.id} covers ${left.filter(r => md(best!.f, r) <= TOL).map(r => r.anim).join(' ')}`); left = left.filter(r => md(best!.f, r) > TOL); }
  for (const r of left) console.log(`! ${r.anim} not within ${TOL} of any candidate (spread ${r.s1.toFixed(3)})`);
  console.log(`swing pairs: ${swing.map(r => `${r.anim}@${r.ts[r.a]}/${r.ts[r.c]}`).join(' ')}`);
  console.log(`frames: ${chosen.length} (${base.length} existing)`);
  const map: string[] = [];
  for (const r of R) { if (swing.includes(r)) { const n = r.S.length; let bits = ''; for (let j = 0; j < n; j++) bits += poseDist(r.S[r.c], r.S[j]) < poseDist(r.S[r.a], r.S[j]) ? '1' : '0';
      let hex = ''; for (let j = 0; j < n; j += 4) hex += parseInt(bits.slice(j, j + 4).padEnd(4, '0'), 2).toString(16);
      const pm = r.S.reduce((x, y) => x + Math.min(poseDist(r.S[r.a], y), poseDist(r.S[r.c], y)), 0) / n;
      console.log(`  ${r.anim.padEnd(14)} ⇄ ${r.anim}@${r.ts[r.a]} / ${r.anim}@${r.ts[r.c]} ${pm.toFixed(3)}`); map.push(`${r.anim}: ['${r.anim}@${r.ts[r.a]}', '${r.anim}@${r.ts[r.c]}', '${hex}']`); continue; }
    const d = chosen.map(c => ({ id: c.id, d: md(c.f, r) })).sort((x, y) => x.d - y.d); console.log(`  ${r.anim.padEnd(14)} → ${d[0].id} ${d[0].d.toFixed(3)}`); map.push(`${r.anim}: ['${d[0].id}']`); }
  console.log('NEW FRAMES:', chosen.slice(base.length).map(c => c.id).join(' '));
  console.log('MAP:\n' + map.join(',\n'));
}
