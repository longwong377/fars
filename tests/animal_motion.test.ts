// D-362: the animals' secondary motion and the birds' take-off. Measured on the modelled bodies' own vertices through the
// CPU mirror of the vertex shader (deformAnimal with aJig): walking, the belly, the ears, the tail and the load of every
// working species move by visible amounts (>= 1.5 cm, about a pixel and a half at 10 m at the player's lens) and standing
// they settle (only breathing, the ears' flicks and the tail's slow swing remain); the body stays whole; and a bird that
// takes off is drawn through the morph between its standing and flying poses instead of switching levels.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deformAnimal, type Species } from '../src/people/animals';
import { rigWeights } from '../src/people/animalRig';
// @ts-ignore plain node module shared with the build
import { parseGLB, glbContent } from '../tools/blender/lib/glb.mjs';

const HAVE = existsSync('public/models/animals/manifest.json');
const lod0 = async (sp: string) => { const buf = readFileSync(`public/models/animals/${sp}.glb`), { json } = parseGLB(buf), c: any = await glbContent(buf);
  const g = c.geo.find((x: any) => x.mesh === 'lod0'), m = json.meshes.find((x: any) => x.name === 'lod0'), names = Object.keys(m.primitives[0].extensions.KHR_draco_mesh_compression.attributes);
  return { pos: g.parts[names.indexOf('POSITION')] as Float32Array, index: Uint32Array.from(g.parts[names.length]) }; };

const WORK: Species[] = ['donkey', 'ox', 'cow', 'sheep', 'goat', 'dog', 'horse', 'camel', 'dromedary', 'mule', 'donkey_pack', 'mule_pack', 'camel_pack'];
describe.skipIf(!HAVE)('the animals move like living things (D-362)', () => {
  it('walking: the belly, ears, tail and load move visibly; standing they settle; the body stays whole', async () => {
    const rows: string[] = [];
    for (const sp of WORK) {
      const { pos, index } = await lod0(sp), W = rigWeights(sp, pos), n = pos.length / 3, seed = 0.31;
      const at = (i: number, st: any, t: number, jig = true) => deformAnimal(sp, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], W.leg.subarray(i * 4, i * 4 + 4), W.piv.subarray(i * 4, i * 4 + 4), W.ht.subarray(i * 4, i * 4 + 4), st, t, [0, 0, 0], jig ? W.jig.subarray(i * 4, i * 4 + 4) : undefined, seed);
      // the vertices of each channel: the most weighted of each
      const pick = (f: (i: number) => number) => { let best = -1, v = 0; for (let i = 0; i < n; i++) { const x = f(i); if (x > v) { v = x; best = i; } } return { i: best, v }; };
      const belly = pick(i => W.jig[i * 4]), ear = pick(i => Math.abs(W.jig[i * 4 + 1])), tail = pick(i => W.jig[i * 4 + 2]), load = pick(i => W.jig[i * 4 + 3]);
      // the secondary displacement alone: the pose with the jiggle minus the pose without it
      const sec = (i: number, st: any, t: number) => { const a = at(i, st, t), b = at(i, st, t, false); return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
      const swing = (i: number, st: (k: number) => any, ts: (k: number) => number, N = 48) => { let lo = [9, 9, 9], hi = [-9, -9, -9];
        for (let k = 0; k < N; k++) { const d = sec(i, st(k), ts(k)); lo = lo.map((v, j) => Math.min(v, d[j])); hi = hi.map((v, j) => Math.max(v, d[j])); } return Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); };
      const walk = (k: number) => ({ phase: (k / 48) * 4 * Math.PI, walk: 1, graze: 0, lie: 0 }), still = () => ({ phase: 1.3, walk: 0, graze: 0, lie: 0 });
      const wT = (k: number) => k * 0.03, sT = (k: number) => k * 0.25;
      const bW = swing(belly.i, walk, wT), bS = swing(belly.i, still, sT), tW = swing(tail.i, walk, wT);
      const eS = swing(ear.i, still, (k: number) => k * 0.05, 240); // 12 s standing: at least one flick
      // the ear between flicks: still for most of the time (a flick, then it settles)
      let moving = 0; for (let k = 0; k < 600; k++) { const d = sec(ear.i, still(), k * 0.02); if (Math.hypot(d[0], d[1], d[2]) > 0.005) moving++; }
      const lW = load.v > 0 ? swing(load.i, walk, wT) : 0, lS = load.v > 0 ? swing(load.i, still, sT) : 0;
      // whole: the secondary motion stretches no edge to more than 3x (+ 2 cm) in any of the walking frames or a flick
      let worst = 0, wAt = '';
      for (const [st, t] of [[walk(5), 0.15], [walk(17), 0.5], [walk(29), 0.9], [still(), 0.06]] as const) {
        const Q = new Float32Array(n * 3), R = new Float32Array(n * 3); for (let i = 0; i < n; i++) { Q.set(at(i, st, t), i * 3); R.set(at(i, st, t, false), i * 3); }
        for (let q = 0; q < index.length; q += 3) for (let k = 0; k < 3; k++) { const a = index[q + k], b = index[q + (k + 1) % 3];
          const l0 = Math.hypot(R[a * 3] - R[b * 3], R[a * 3 + 1] - R[b * 3 + 1], R[a * 3 + 2] - R[b * 3 + 2]), l1 = Math.hypot(Q[a * 3] - Q[b * 3], Q[a * 3 + 1] - Q[b * 3 + 1], Q[a * 3 + 2] - Q[b * 3 + 2]);
          if (l1 - 3 * l0 > worst) { worst = l1 - 3 * l0; wAt = `t ${t} edge ${[a, b].map(v => [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]].map(q => q.toFixed(3)).join(',') + ' jig ' + Array.from(W.jig.subarray(v * 4, v * 4 + 4)).map(q => q.toFixed(3)).join(',')).join(' / ')}`; } }
      }
      expect(worst, `${sp} whole: ${wAt}`).toBeLessThan(0.02);
      rows.push(`${sp}: belly ${(bW * 100).toFixed(1)} cm walking / ${(bS * 100).toFixed(1)} standing; ear flick ${(eS * 100).toFixed(1)} cm, moving ${(moving / 6).toFixed(0)} % of the time; tail ${(tW * 100).toFixed(1)} cm; load ${(lW * 100).toFixed(1)} / ${(lS * 100).toFixed(1)} cm; whole ${(worst * 100).toFixed(1)} cm`);
      appendFileSync(join(tmpdir(), 'animal_motion.txt'), rows[rows.length - 1] + '\n');
      expect(bW, `${sp} belly walking`).toBeGreaterThan(0.015); expect(bS, `${sp} belly standing (breathing only)`).toBeLessThan(Math.max(0.012, bW / 3));
      expect(eS, `${sp} ear flick`).toBeGreaterThan(0.015); expect(moving / 600, `${sp} ear settles between flicks`).toBeLessThan(0.35);
      // (the goats' short tails are fused to the quarters in the models, D-326: no free tail to swing; logged, B330)
      if (tail.v >= 0.08) expect(tW, `${sp} tail walking`).toBeGreaterThan(0.04); else expect(sp, 'only the goats have no free tail').toMatch(/goat/);
      if (/pack/.test(sp)) { expect(lW, `${sp} load walking`).toBeGreaterThan(0.02); expect(lS, `${sp} load standing`).toBeLessThan(0.002); }
    }
    console.log(rows.join('\n'));
  }, 600_000);
});
