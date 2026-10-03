// s18 C14 (D-790): the impostor frames that can go (the atlas over its GPU budget) and a frame for an animation without one.
// For each animation with two keyed frames, its error (the impostor_frames test's mean pose distance over a minute) with one
// key alone; for a named animation, the best time to key its own frame. npx tsx tools/dev/imp_trim.ts [anim-to-key]
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE } from '../../src/people/humanRig';
import { FRAMES, IMP_MAP, poseRig, framePoseOf, poseDist, frameOf, type Frame } from '../../src/people/impostors';
import type { AnimId } from '../../src/people/anim';
const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), ref = A.variants.reduce((x, v) => v.meta.sex === 'm' && v.meta.group === 'adult' && Math.abs(v.height - 1.66) < Math.abs(x.height - 1.66) ? v : x);
const seq = (anim: AnimId) => Array.from({ length: 600 }, (_, i) => poseRig(rig, pal, ref.joints, anim, i / 10, 2 * Math.PI * (i / 10) / 1.1));
const fp = (F: Frame) => framePoseOf(rig, pal, ref.joints, F);
const key = process.argv[2] as AnimId | undefined;
if (key) { const S = seq(key); let best = [9, 0]; for (let t = 0; t < 60; t += 0.5) { const f = fp({ id: 'x', anim: key, ph: 0, t }); let s = 0; for (const p of S) s += poseDist(f, p); s /= S.length; if (s < best[0]) best = [s, t]; } console.log(`${key}: best key t ${best[1]} error ${best[0].toFixed(3)}`); }
else { const out: string[] = [];
  for (const [anim, v] of Object.entries(IMP_MAP)) { if (!v || v.length !== 3) continue; const S = seq(anim as AnimId);
    const now = S.reduce((s, p, i) => s + poseDist(fp(FRAMES[frameOf(anim as AnimId, 0, i / 10)]), p), 0) / S.length;
    for (const k of [0, 1]) { const F = FRAMES.find(f => f.id === v[k]); if (!F) continue; const f = fp(F); const e = S.reduce((s, p) => s + poseDist(f, p), 0) / S.length;
      const other = v[1 - k], shared = Object.entries(IMP_MAP).some(([a, w]) => a !== anim && w?.includes(other)); out.push(`${anim}: keep ${v[k]} alone ${e.toFixed(3)} (now ${now.toFixed(3)}; drops ${other}${shared ? ', shared' : ''})`); } }
  console.log(out.sort((a, b) => +a.split(' alone ')[1].slice(0, 5) - +b.split(' alone ')[1].slice(0, 5)).join('\n')); }
// (--remap: a frame only one animation uses, and that animation's error on the nearest other frame)
if (process.argv.includes('--remap')) { const fps = FRAMES.map(fp), out: string[] = [];
  for (const [anim, v] of Object.entries(IMP_MAP)) { if (!v || v.length !== 1) continue; const users = Object.entries(IMP_MAP).filter(([, w]) => w?.includes(v[0])).length; if (users > 1) continue;
    const S = seq(anim as AnimId), own = FRAMES.findIndex(f => f.id === v[0]); let best = [9, -1];
    for (let j = 0; j < FRAMES.length; j++) { if (j === own || FRAMES[j].id.startsWith('walk') || FRAMES[j].id === 'stand') continue; const e = S.reduce((s, p) => s + poseDist(fps[j], p), 0) / S.length; if (e < best[0]) best = [e, j]; }
    out.push(`${anim} (${v[0]}) -> ${FRAMES[best[1]]?.id} ${best[0].toFixed(3)}`); }
  console.log(out.sort((a, b) => +a.split(' ').pop()! - +b.split(' ').pop()!).slice(0, 10).join('\n')); }
