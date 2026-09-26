// dev (D-255): the crafts' cycles on the reference body, before the tests: each cycle's worst grip and foot IK miss over
// its period, its hits (and their kinds), and the impostor frame nearest to it (the cycle's mean distance to each atlas
// frame; tests/impostor_frames.test.ts wants ≤ 0.09 m to the one IMP_MAP names).
// Usage: npx tsx tools/dev/craft_probe.ts [anim ...]
import { readFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE } from '../../src/people/humanRig';
import { pose, type AnimId } from '../../src/people/anim';
import { IK_STATS } from '../../src/people/poseKit';
import { FRAMES, poseRig, poseDist, framePoseOf, frameOf } from '../../src/people/impostors';

const list = (process.argv.slice(2).length ? process.argv.slice(2) : ['smith', 'bellows', 'chasing', 'weigh', 'seal', 'seal_jar', 'drill', 'scrape', 'pound']) as AnimId[];
const b = readFileSync('public/generated/humans/humans.bin');
const A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const ref = A.variants.reduce((x, v) => v.meta.sex === 'm' && v.meta.group === 'adult' && Math.abs(v.height - 1.66) < Math.abs(x.height - 1.66) ? v : x);
const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
const frameF = FRAMES.map(F => framePoseOf(rig, pal, ref.joints, F));
for (const a of list) {
  let g = 0, l = 0; const kinds = new Map<string, number>(); let last = false;
  for (let i = 0; i < 1200; i++) { const t = i * 0.05; IK_STATS.reset(); const po = pose(a, t, t * 4.2, 0.7); g = Math.max(g, IK_STATS.grip); l = Math.max(l, IK_STATS.leg);
    if (po.hit && !last) kinds.set(po.hitKind ?? '(own)', (kinds.get(po.hitKind ?? '(own)') ?? 0) + 1); last = !!po.hit; }
  const S: Float64Array[] = []; for (let i = 0; i < 600; i++) S.push(poseRig(rig, pal, ref.joints, a, i / 10, 2 * Math.PI * (i / 10) / 1.1));
  const d = frameF.map((F, fi) => ({ id: FRAMES[fi].id, d: S.reduce((s, x) => s + poseDist(F, x), 0) / S.length })).sort((x, y) => x.d - y.d);
  let cur = 0; for (let i = 0; i < 600; i++) cur += poseDist(frameF[frameOf(a, 0, i / 10)], S[i]); cur /= 600;
  console.log(`${a}: grip miss ${(g * 100).toFixed(1)} cm, foot miss ${(l * 100).toFixed(1)} cm; hits/60 s ${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; mapped ${cur.toFixed(3)} m; nearest ${d.slice(0, 3).map(x => `${x.id} ${x.d.toFixed(3)}`).join(', ')}`);
}
