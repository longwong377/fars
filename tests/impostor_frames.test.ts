// D-229 (Phase 5 review M4): distance never breaks the activity (brief §9.5). Every animation a person can be given has
// an impostor frame that is its own pose, measured, not named: the cycle is sampled (60 s at 0.1 s, the bake's k) on the
// working man's reference body and compared with the frame(s) frameOf shows at each moment (impostors.ts POSE_BONES,
// RMS over 13 bone heads). Nothing that works, sits, kneels, bends, rides or plays is drawn with the standing frame, and
// the crowd counts any animation without a frame of its own as a placeholder (impFallback).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE } from '../src/people/humanRig';
import { ANIMS, type AnimId } from '../src/people/anim';
import { ACTIVITIES, type ActivityId } from '../src/people/activities';
import { PLAYING } from '../src/people/playing';
import { FRAMES, IMP_GAITS, IMP_MAP, frameOf, framesOf, impFallback, poseRig, framePoseOf, poseDist } from '../src/people/impostors';

let A: HumanAssets, rig: RigSolver, pal: Float32Array, ref: HumanAssets['variants'][number];
const TOL = 0.09, STAND = FRAMES.findIndex(f => f.id === 'stand'), WALK = new Set(FRAMES.map((f, i) => f.id.startsWith('walk') ? i : -1).filter(i => i >= 0));
/** standing still: the only animations the standing frame may stand for */
const STILL = new Set<AnimId>(['idle', 'inspect']);
beforeAll(() => {
  const b = readFileSync('public/generated/humans/humans.bin');
  A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  rig = new RigSolver(A.meta.curlAxes); pal = new Float32Array(PALETTE_STRIDE);
  ref = A.variants.reduce((x, v) => v.meta.sex === 'm' && v.meta.group === 'adult' && Math.abs(v.height - 1.66) < Math.abs(x.height - 1.66) ? v : x);
});

/** every animation the activities, their variants and the playing performances can give */
function scheduled(): Map<AnimId, string> {
  const m = new Map<AnimId, string>();
  for (const [id, P] of Object.entries(ACTIVITIES) as [ActivityId, any][]) { m.set(P.anim, id); for (const v of P.variants ?? []) if (v.anim) m.set(v.anim, `${id} (variant)`); }
  for (const [k, P] of Object.entries(PLAYING) as [string, any][]) if (P.anim) m.set(P.anim, `playing ${k}`);
  return m;
}

describe('impostor frames (D-229): every activity drawn as itself at any distance', () => {
  it('every animation has frames of its own; the standing frame only for standing still; the gaits step', () => {
    const bad: string[] = [];
    for (const anim of ANIMS) { const fr = framesOf(anim);
      if (impFallback(anim)) bad.push(`${anim}: no frame (fallback)`);
      if (fr.includes(STAND) && !STILL.has(anim)) bad.push(`${anim}: the standing frame`);
      if (IMP_GAITS.has(anim) && !(fr.length === 6 && fr.every(i => WALK.has(i)))) bad.push(`${anim}: a gait not on the walk's six frames`); }
    expect(bad).toEqual([]);
    const sch = scheduled(); expect(sch.size).toBeGreaterThan(40);
    for (const [anim, by] of sch) { expect(ANIMS, `${anim} (${by})`).toContain(anim); expect(impFallback(anim), `${anim} (${by})`).toBe(false); }
    for (const [k, v] of Object.entries(IMP_MAP)) for (const id of v!.slice(0, v!.length === 3 ? 2 : 1)) expect(FRAMES.some(f => f.id === id), `${k} → ${id}`).toBe(true);
  });
  it('each animation\'s cycle lies within 0.09 m of the frame shown at each moment (the swing cycles alternate)', () => {
    const rows: string[] = [], bad: string[] = [];
    const frameF = FRAMES.map(F => framePoseOf(rig, pal, ref.joints, F));
    for (const anim of ANIMS) { if (IMP_GAITS.has(anim) || anim === 'carry_head' || anim === 'carry_shoulder') continue;
      let s = 0, n = 0, stand = 0; for (let i = 0; i < 600; i++) { const t = i / 10; const p = poseRig(rig, pal, ref.joints, anim, t, 2 * Math.PI * t / 1.1), f = frameOf(anim, 0, t);
        s += poseDist(frameF[f], p); n++; stand += poseDist(frameF[STAND], p); }
      rows.push(`${anim} ${(s / n).toFixed(3)} (stand ${(stand / n).toFixed(3)})`); if (s / n > TOL) bad.push(rows[rows.length - 1]); }
    console.log(rows.join('; '));
    expect(bad).toEqual([]);
  }, 120_000);
  it('the carriers step: the two strides alternate on the gait phase', () => {
    for (const a of ['carry_head', 'carry_shoulder'] as AnimId[]) { expect(frameOf(a, Math.PI / 2)).not.toBe(frameOf(a, Math.PI * 1.5)); expect(framesOf(a)).toHaveLength(2); }
  });
});
