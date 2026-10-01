// D-363: the rig's cost with and without the body (girth, extras, soft tissue) for 300 people walking (µs a person)
import { loadA } from './body_variety';
import { RigSolver, PALETTE_STRIDE, type RigInput } from '../../src/people/humanRig';
import { pose } from '../../src/people/anim';
import { lookFor } from '../../src/people/looks';
const A = loadA(), rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE * 300);
const people = Array.from({ length: 300 }, (_, i) => { const L = lookFor(A, { id: i, sex: i % 2 ? 'f' : 'm', role: 'porter', dress: i % 2 ? 'woman' : 'worker', seed: 1000 + i }, 1), v = A.variants[L.variant];
  return { L, inp: { joints: v.joints, pose: { rot: {}, hips: [0, 0, 0] }, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: true, t: 0 } as RigInput }; });
for (const withBody of [false, true, false, true]) { let best = Infinity;
  for (let run = 0; run < 5; run++) { const t0 = performance.now(); for (let f = 0; f < 20; f++) { const t = (run * 20 + f) / 60; people.forEach((p, i) => { p.inp.body = withBody ? p.L.body : undefined; p.inp.t = t; p.inp.z = 1.2 * t; p.inp.pose = pose('walk', t, t * 5.6, 0.3); rig.setPose(p.inp); rig.solve(p.inp, pal, i * PALETTE_STRIDE); }); }
    best = Math.min(best, (performance.now() - t0) / 20); }
  console.log(withBody ? 'with body' : 'without  ', best.toFixed(3), 'ms a frame for 300'); }
