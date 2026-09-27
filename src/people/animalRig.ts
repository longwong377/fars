// The rig weights of the animals' modelled bodies (D-326): "weights transferred" from the anatomy (animalForm.ts), not painted.
// Kept apart from the anatomy so the weights can be tuned without rebuilding the models (tools/blender/lib/animal_inputs.mjs
// hashes the anatomy, not this file): they are computed at load, per vertex of each level (animalModels.ts rigLevel).
import { smoothstep } from '../arch/sdf';
import { ANIMAL_BUILD, type Species } from './animals';
import { animalForm, type Group, type Prim } from './animalForm';

/** the rig attributes of a loaded level's vertices (animals.ts: aLeg = (gait phase, leg weight, knee weight, fore/hind),
 *  aPiv = (hip y, z, knee y, z), aHT = (head weight, tail weight, pivot y, z)), from the anatomy: each vertex follows the
 *  group whose parts are nearest (legs, neck and head, tail, else the rigid torso and gear), blended over a band as wide as
 *  the smooth unions' own blends; the legs' weight fades in over the hip, the knee's over the knee (and only on the leg), and
 *  the head's along the neck from its root to its middle (the neck bends along its length, as a neck does, instead of
 *  hinging at one ring). The pivots and angles are the procedural rig's, so every gait, graze and lie cycle of the vertex
 *  shader drives the modelled body unchanged (tests/animal_models.test.ts: no edge torn in any pose). */
export function rigWeights(sp: Species, pos: ArrayLike<number>): { leg: Float32Array; piv: Float32Array; ht: Float32Array } {
  const F = animalForm(sp), R = F.rig, B = ANIMAL_BUILD[sp], n = pos.length / 3, g = B.girth;
  const leg = new Float32Array(n * 4), piv = new Float32Array(n * 4), ht = new Float32Array(n * 4);
  const byG = new Map<Group, Prim[]>(); for (const p of F.prims) { const k = p.group === 'gear' ? 'body' : p.group; if (!byG.has(k)) byG.set(k, []); byG.get(k)!.push(p); }
  const dG = (G: Group, x: number, y: number, z: number) => { let d = 1e9; for (const p of byG.get(G) ?? []) { const lb = Math.sqrt((x - p.c[0]) ** 2 + (y - p.c[1]) ** 2 + (z - p.c[2]) ** 2) - p.R; if (lb > d) continue; const v = p.f(x, y, z); if (v < d) d = v; } return d; };
  const kL = Math.max(0.02, 0.14 * g), kH = Math.max(0.015, 0.1 * g), kT = Math.max(0.01, 0.07 * g);
  const nLeg = R.legs.length, nd = R.neckDir;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const db = dG('body', x, y, z), dh = dG('head', x, y, z), dt = dG('tail', x, y, z);
    let li = 0, dl = 1e9; for (let j = 0; j < nLeg; j++) { const d = dG(`leg${j}` as Group, x, y, z); if (d < dl) { dl = d; li = j; } }
    const L = R.legs[li];
    const wl = smoothstep(-kL, kL, Math.min(db, dh, dt) - dl) * smoothstep(R.hipY + 0.08 * g, R.hipY - 0.3 * g, y);
    const wk = smoothstep(R.kneeY + B.leg * 1.4, R.kneeY - B.leg * 1.4, y) * smoothstep(0.2, 0.8, wl);
    leg.set([L.phase, wl, wk, L.fore], i * 4); piv.set([R.hipY, L.z, R.kneeY, L.zk], i * 4);
    const tN = ((x - R.base[0]) * nd[0] + (y - R.base[1]) * nd[1] + (z - R.base[2]) * nd[2]) / R.neck;
    const wh = smoothstep(-kH, kH, Math.min(db, dl, dt) - dh) * smoothstep(-0.1, 0.6, tN) * (1 - wl);
    const wt = smoothstep(-kT, kT, Math.min(db, dl, dh) - dt) * smoothstep(-0.03, 0.06, R.tailRoot[2] - z + 0.03) * (1 - wl);
    if (wh >= wt) ht.set([wh, 0, R.base[1], R.base[2]], i * 4); else ht.set([0, wt, R.tailRoot[1], R.tailRoot[2]], i * 4);
  }
  return { leg, piv, ht };
}
