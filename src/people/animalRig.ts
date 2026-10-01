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
export function rigWeights(sp: Species, pos: ArrayLike<number>): { leg: Float32Array; piv: Float32Array; ht: Float32Array; jig: Float32Array } {
  const F = animalForm(sp), R = F.rig, B = ANIMAL_BUILD[sp], n = pos.length / 3, g = B.girth;
  const leg = new Float32Array(n * 4), piv = new Float32Array(n * 4), ht = new Float32Array(n * 4), jig = new Float32Array(n * 4);
  const byG = new Map<Group, Prim[]>(); for (const p of F.prims) { const k = p.group === 'gear' ? 'body' : p.group; if (!byG.has(k)) byG.set(k, []); byG.get(k)!.push(p); }
  const J = jigParts(sp, F);
  const dG = (G: Group, x: number, y: number, z: number) => { let d = 1e9; for (const p of byG.get(G) ?? []) { const lb = Math.sqrt((x - p.c[0]) ** 2 + (y - p.c[1]) ** 2 + (z - p.c[2]) ** 2) - p.R; if (lb > d) continue; const v = p.f(x, y, z); if (v < d) d = v; } return d; };
  const kS = Math.max(0.012, 0.9 * B.headR), kL = Math.max(0.02, 0.16 * g), kH = Math.max(0.02, 0.16 * g), kT = Math.max(0.01, 0.07 * g);
  const nLeg = R.legs.length, nd = R.neckDir;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const db = dG('body', x, y, z), dn = dG('head', x, y, z), dsk = dG('skull', x, y, z), dh = Math.min(dn, dsk), dt = dG('tail', x, y, z);
    let li = 0, dl = 1e9; for (let j = 0; j < nLeg; j++) { const d = dG(`leg${j}` as Group, x, y, z); if (d < dl) { dl = d; li = j; } }
    const L = R.legs[li];
    const wl = smoothstep(-kL, kL, Math.min(db, dh, dt) - dl) * smoothstep(R.hipY + 0.08 * g, R.hipY - 0.3 * g, y);
    const wk = smoothstep(R.kneeY + B.leg * 1.4, R.kneeY - B.leg * 1.4, y) * smoothstep(0.2, 0.8, wl);
    leg.set([L.phase, wl, wk, L.fore], i * 4); piv.set([R.hipY, L.z, R.kneeY, L.zk], i * 4);
    const tN = ((x - R.base[0]) * nd[0] + (y - R.base[1]) * nd[1] + (z - R.base[2]) * nd[2]) / R.neck;
    const wh = smoothstep(-kH, kH, Math.min(db, dl, dt) - dh) * smoothstep(-0.25, 0.7, tN) * (1 - wl);
    const wt = smoothstep(-kT, kT, Math.min(db, dl, dh) - dt) * smoothstep(-0.03, 0.06, R.tailRoot[2] - z + 0.03) * (1 - wl);
    // Q-980: the skull's weight on the poll's joint (stored as -aHT.y), where the skull's parts are nearer than the neck's
    const ws = wh * smoothstep(-kS, kS, dn - dsk);
    if (wh >= wt) ht.set([wh, -ws, R.base[1], R.base[2]], i * 4); else ht.set([0, wt, R.tailRoot[1], R.tailRoot[2]], i * 4);
    jig.set(J(x, y, z, wl, wh, wt, db, dt), i * 4);
  }
  return { leg, piv, ht, jig };
}

/** D-362: the secondary-motion weights (aJig) of a vertex, from the same anatomy: x the soft tissue that swings with the gait
 *  (the belly under the barrel, the cattle's dewlap, the udder, the camels' humps; 0-1), y the ear's lever (m from where the
 *  ear leaves the skull, signed by the side: the ear turns about its root), z the tail's lever along its chain (m from the
 *  root, x the tail's weight: the chain bends more towards its tip), w the load's lever (m below the top of the load: the
 *  panniers and sacks swing as pendulums from it; the pad, the cloth and the girth stay with the body) */
export function jigParts(sp: Species, F: ReturnType<typeof animalForm>) {
  const R = F.rig, B = ANIMAL_BUILD[sp], g = B.girth, L = B.len, by = R.bodyY, bellyY = by - 0.52 * g, backY = by + 0.52 * g;
  const near = (ps: Prim[], x: number, y: number, z: number) => { let d = 1e9; for (const p of ps) { const lb = Math.sqrt((x - p.c[0]) ** 2 + (y - p.c[1]) ** 2 + (z - p.c[2]) ** 2) - p.R; if (lb > d) continue; const v = p.f(x, y, z); if (v < d) d = v; } return d; };
  const ears = F.prims.filter(p => p.tag === 'ear'), skull = F.prims.filter(p => (p.group === 'skull' || p.group === 'head') && p.tag !== 'ear');
  const isLoad = (p: Prim) => p.group === 'gear' && (p.part === 'wicker' || p.part === 'sack' || (p.part === 'rope' && Math.abs(p.c[0]) > 0.05));
  const load = F.prims.filter(isLoad), notLoad = F.prims.filter(p => (p.group === 'body' || p.group === 'gear') && !isLoad(p));
  const loadTop = load.reduce((m, p) => Math.max(m, p.c[1]), -1e9);
  const camel = /^(camel|dromedary)/.test(sp), fowl = !!B.biped;
  // the dewlap of the cattle (animalForm: a fold from the throat to the brisket along a -> b, hanging forward of that line)
  let dew: null | { a: number[]; u: number[]; len: number; dn: number[]; D: number } = null;
  if (/^(ox|cow|calf|zebu)$/.test(sp)) {
    const nd = R.neckDir, np = [0, nd[2], -nd[1]], nl = Math.hypot(np[1], np[2]), hr = B.headR;
    const a = [0, R.base[1] + (R.top[1] - R.base[1]) * 0.8 - (np[1] / nl) * hr, R.base[2] + (R.top[2] - R.base[2]) * 0.8 - (np[2] / nl) * hr], b = [0, bellyY + 0.12 * g, 0.44 * L];
    const len = Math.hypot(b[1] - a[1], b[2] - a[2]), u = [0, (b[1] - a[1]) / len, (b[2] - a[2]) / len], dn = u[1] > 0 ? [0, u[2], -u[1]] : [0, -u[2], u[1]];
    if (dn[2] < 0) { dn[1] = -dn[1]; dn[2] = -dn[2]; }
    dew = { a, u, len, dn, D: (sp === 'zebu' ? 0.2 : 0.12) * g };
  }
  const out = [0, 0, 0, 0];
  return (x: number, y: number, z: number, wl: number, wh: number, wt: number, db: number, dt: number): number[] => {
    out[0] = out[1] = out[2] = out[3] = 0;
    const wb = Math.max(0, 1 - wl - wh - wt);
    // the belly (and the udder): body vertices below the barrel's middle, fading towards the chest and the quarters
    if (!fowl) out[0] = wb * smoothstep(by - 0.1 * g, bellyY, y) * (1 - smoothstep(0.28 * L, 0.48 * L, Math.abs(z + 0.03 * L)));
    else out[0] = 0.5 * wb * smoothstep(by, bellyY, y); // the fowl's breast and keel feathers
    if (camel) out[0] = Math.max(out[0], 0.7 * wb * smoothstep(backY - 0.02 * g, backY + 0.3 * g, y));
    if (dew && Math.abs(x) < 0.07 * g) { const vy = y - dew.a[1], vz = z - dew.a[2], s = (vy * dew.u[1] + vz * dew.u[2]) / dew.len, dd = vy * dew.dn[1] + vz * dew.dn[2];
      if (s > -0.05 && s < 1.05) out[0] = Math.max(out[0], smoothstep(0, dew.D, dd) * smoothstep(-0.05, 0.15, s) * smoothstep(1.05, 0.85, s)); }
    // the ears: where an ear's parts are nearer than the skull's, the lever is the distance from the skull's surface
    if (ears.length && Math.hypot(x - R.top[0], y - R.top[1], z - R.top[2]) < 0.6) {
      const dE = near(ears, x, y, z), dS = near(skull, x, y, z), we = smoothstep(-0.008, 0.008, dS - dE);
      if (we > 0) out[1] = Math.sign(x || 1) * we * Math.max(0, dS);
    }
    // the tail's chain
    // (its own weight, blended over a wider band than the swish's: the tail's hair hangs against the quarters, and the chain
    // swings its far end most, so a sharp edge between tail and body would tear there)
    const wj = smoothstep(-0.08, 0.08, db - dt) * smoothstep(-0.02, 0.06, R.tailRoot[2] - z) * (1 - wl);
    if (wj > 0) out[2] = wj * Math.hypot(x - R.tailRoot[0], y - R.tailRoot[1], z - R.tailRoot[2]);
    // the load
    if (load.length && db < 0.3) { const dL = near(load, x, y, z), dN = near(notLoad, x, y, z), w = smoothstep(-0.01, 0.01, dN - dL);
      if (w > 0) { out[3] = w * (0.02 + Math.max(0, loadTop - y)); out[0] *= 1 - w; } } // (a load does not breathe)
    return out;
  };
}
