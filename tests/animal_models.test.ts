// D-326: the animals' modelled bodies (tools/blender/animals.mjs -> public/models/animals/; src/people/animalForm.ts,
// animalModels.ts). Every species of the game has its model, current with its inputs, within the triangle budgets, with
// UVs, normals and tangents and non-blank maps; the rig weighted from the anatomy drives each level as it drove the
// procedural stand-in (grazing brings the muzzle to the ground, walking swings the legs, lying rests the belly down, the
// body stays whole); and the Animals class draws the model's levels by distance within the fauna's budget.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { SPECIES, ANIMAL_BUILD, deformAnimal, lieDrop, Animals, type Species } from '../src/people/animals';
import { animalForm, FAMILY } from '../src/people/animalForm';
import { rigWeights } from '../src/people/animalRig';
import { setAnimalModel, clearAnimalModels } from '../src/people/animalModels';
// @ts-ignore plain node module shared with the build
import { parseGLB, glbContent } from '../tools/blender/lib/glb.mjs';
// @ts-ignore plain node module shared with the build
import { animalHash, realHash } from '../tools/blender/lib/animal_inputs.mjs';
import { setRealRig, clearRealRigs } from '../src/people/animalReal';

const HAVE = existsSync('public/models/animals/manifest.json');
const MAN = (HAVE ? JSON.parse(readFileSync('public/models/animals/manifest.json', 'utf8')) : { assets: {} }) as { assets: Record<string, any> };
const REG = JSON.parse(readFileSync('tools/blender/animals.json', 'utf8'));
const REAL = JSON.parse(readFileSync('tools/blender/animals_real.json', 'utf8'));
// V5 D-520: the library models' rigs as the loader registers them (animalModels.ts)
for (const [sp, e] of Object.entries(MAN.assets) as [string, any][]) if (e.real) setRealRig(sp, e.rig);
/** the decoded levels of a species' GLB: { lod0: { attributes: { POSITION, NORMAL, TANGENT, TEXCOORD_0 }, index }, lod1 } */
const levels = async (sp: string) => { const buf = readFileSync(`public/models/animals/${sp}.glb`), { json } = parseGLB(buf), c: any = await glbContent(buf), out: any = {};
  for (const g of c.geo) { const m = json.meshes.find((x: any) => x.name === g.mesh), names = Object.keys(m.primitives[0].extensions.KHR_draco_mesh_compression.attributes), attributes: any = {};
    names.forEach((n, i) => { attributes[n] = g.parts[i]; }); out[g.mesh] = { attributes, index: Uint32Array.from(g.parts[names.length]) }; }
  return out; };

describe.skipIf(!HAVE)('the animals are modelled bodies (D-326)', () => {
  it('every species of the game is registered, built, current and within its budgets', () => {
    expect(Object.keys(REG.species).sort()).toEqual([...SPECIES].sort());
    for (const sp of SPECIES) {
      const e = MAN.assets[sp]; expect(e, `${sp} built`).toBeTruthy();
      if (e.real) expect(e.inHash, `${sp} current (node tools/blender/animals_real.mjs ${sp})`).toBe(realHash(sp));
      else expect(e.inHash, `${sp} current (node tools/blender/animals.mjs ${sp})`).toBe(animalHash(sp));
      const C = e.real ? REAL.classes[REAL.species[sp].class] : REG.classes[REG.species[sp]];
      expect(e.tris[0], `${sp} lod0`).toBeLessThanOrEqual(C.tris[0] * 1.02); if (!e.real) expect(e.tris[0]).toBeGreaterThan(C.tris[0] * 0.8); else expect(e.tris[0]).toBeGreaterThan(C.tris[0] * 0.4);
      expect(e.tris[1], `${sp} lod1`).toBeLessThanOrEqual(C.tris[1] * 1.05); expect(e.tris[1]).toBeLessThan(e.tris[0] / 3);
      for (const [f, m] of Object.entries(e.files) as [string, any][]) { const b = readFileSync(`public/models/animals/${f}`); expect(b.length, f).toBe(m.bytes); }
      expect(e.ao_mean, `${sp} occlusion baked`).toBeGreaterThan(0.2); expect(e.ao_mean).toBeLessThan(0.99);
      expect(e.mask_mean, `${sp} coat mask baked`).toBeGreaterThan(0.05); if (e.real) expect(e.source?.licence, `${sp} credited`).toMatch(/^CC/);
      const { json } = parseGLB(readFileSync(`public/models/animals/${sp}.glb`)); expect(json.extensionsUsed).toContain('KHR_draco_mesh_compression');
      for (const n of ['lod0', 'lod1']) { const mesh = json.meshes.find((m: any) => m.name === n); expect(mesh, `${sp} ${n}`).toBeTruthy(); for (const a of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0']) expect(mesh.primitives[0].attributes[a], `${sp} ${n} ${a}`).toBeDefined(); }
    }
    const bytes = Object.values(MAN.assets).reduce((a: number, e: any) => a + Object.values(e.files).reduce((b: number, f: any) => b + f.bytes, 0), 0);
    console.log(`animals: ${SPECIES.length} species, ${(bytes / 1e6).toFixed(1)} MB`); expect(bytes).toBeLessThan(60e6);
  });
  it('the rig weighted from the anatomy drives every level: stands, grazes, walks, lies, and stays whole', async () => {
    const rows: string[] = [];
    for (const sp of SPECIES) {
      const c: any = await levels(sp);
      for (const [li, name] of [[0, 'lod0'], [1, 'lod1']] as const) {
        const prim = c[name]; const pos: Float32Array = prim.attributes.POSITION;
        const W = rigWeights(sp, pos), n = pos.length / 3, F = animalForm(sp);
        let worst = '', minStand = 9, lowHead = 9, maxLegDz = 0, lowBody = 9, legLow = 9, stretch = 0;
        const at = (i: number, st: any) => deformAnimal(sp, [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], W.leg.subarray(i * 4, i * 4 + 4), W.piv.subarray(i * 4, i * 4 + 4), W.ht.subarray(i * 4, i * 4 + 4), st, 0);
        for (let i = 0; i < n; i++) {
          minStand = Math.min(minStand, pos[i * 3 + 1]);
          if (W.ht[i * 4] > 0.9) lowHead = Math.min(lowHead, at(i, { phase: 0, walk: 0, graze: 1, lie: 0 })[1]);
          if (W.leg[i * 4 + 1] > 0.9) { const a = at(i, { phase: 0, walk: 1, graze: 0, lie: 0 }), b = at(i, { phase: Math.PI, walk: 1, graze: 0, lie: 0 }); maxLegDz = Math.max(maxLegDz, Math.abs(a[2] - b[2])); legLow = Math.min(legLow, at(i, { phase: 0, walk: 0, graze: 0, lie: 1 })[1]); }
          else if (W.leg[i * 4 + 1] < 0.05 && W.ht[i * 4] < 0.05 && W.ht[i * 4 + 1] < 0.05) lowBody = Math.min(lowBody, at(i, { phase: 0, walk: 0, graze: 0, lie: 1 })[1]);
        }
        // the body stays whole: no edge stretched to more than 3x (+ 3 cm) by the walk; the lying fold and the graze bend the skin
        // over the elbow and along the neck's crest (one neck joint at the breast: the crest over the withers stretches as the
        // head goes down), within 8 and 20 cm
        const idx: Uint32Array | Uint16Array = prim.index, poses = [{ phase: 0.7, walk: 1, graze: 0, lie: 0, lim: 0 }, { phase: 0, walk: 0, graze: 1, lie: 0, lim: 0.17 }, { phase: 0, walk: 0, graze: 0, lie: 1, lim: MAN.assets[sp].real ? 0.3 : 0.05 }];
        // (V5 D-520: a library model's coarser hide folds over its hocks and the hanging tail when it lies, up to 30 cm (the kneeling dromedary): B550)
        for (const st of poses) { const Q = new Float32Array(n * 3); for (let i = 0; i < n; i++) Q.set(at(i, st), i * 3);
          for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3];
            const l0 = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]), l1 = Math.hypot(Q[a * 3] - Q[b * 3], Q[a * 3 + 1] - Q[b * 3 + 1], Q[a * 3 + 2] - Q[b * 3 + 2]);
            if (l1 - 3 * l0 - st.lim > stretch) { stretch = l1 - 3 * l0 - st.lim; worst = JSON.stringify({ st, p: [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]].map(v => +v.toFixed(2)), wa: [W.leg[a * 4 + 1], W.leg[a * 4 + 2], W.ht[a * 4], W.ht[a * 4 + 1]].map(v => +v.toFixed(2)), wb: [W.leg[b * 4 + 1], W.leg[b * 4 + 2], W.ht[b * 4], W.ht[b * 4 + 1]].map(v => +v.toFixed(2)) }); } } }
        if (stretch > 0.025) console.log('WORST', sp, name, worst); rows.push(`${sp} ${name}: ${n} v, stand ${minStand.toFixed(3)}, graze ${lowHead.toFixed(3)}, stride ${maxLegDz.toFixed(2)}, lie body ${lowBody.toFixed(3)} legs ${legLow.toFixed(3)}, stretch ${stretch.toFixed(3)}`);
        if (process.env.ANIM_ROWS) { appendFileSync(process.env.ANIM_ROWS, rows[rows.length - 1] + (stretch > 0.025 ? ' WORST ' + worst : '') + '\n'); continue; } // (a survey of every species, no assertions)
        expect(minStand, `${sp} ${name} stands on the ground`).toBeGreaterThan(-0.01); expect(minStand).toBeLessThan(0.03);
        expect(lowHead, `${sp} ${name} grazes`).toBeLessThan(0.12); expect(lowHead).toBeGreaterThan(-0.08);
        expect(maxLegDz, `${sp} ${name} walks`).toBeGreaterThan(0.08);
        expect(lowBody, `${sp} ${name} lies on its belly (the cattle's deep belly and udder settle up to 13 cm into the ground: the rig's drop is the stand-in's; a library model's chest up to 20 cm, B550)`).toBeGreaterThan(MAN.assets[sp].real ? -0.2 : -0.15); expect(lowBody).toBeLessThan(0.1);
        expect(legLow, `${sp} ${name}'s folded legs (under the ground they are hidden: the camels' long legs reach 15 cm)`).toBeGreaterThan(MAN.assets[sp].real ? -0.3 : -0.2); // (a library model's longer cannon bones: B550)
        expect(stretch, `${sp} ${name} stays whole`).toBeLessThan(0.03);
        expect(FAMILY[sp]).toBeTruthy(); expect(lieDrop(sp)).toBeGreaterThan(0); void li; void F;
      }
    }
    console.log(rows.join('\n'));
  }, 600_000);
  it('the Animals class draws the modelled levels by distance (lod1 beyond lod1At), their triangles counted', async () => {
    clearAnimalModels();
    const c: any = await levels('sheep'), geo = (name: string) => { const p = c[name], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.attributes.POSITION, 3)); g.setAttribute('normal', new THREE.BufferAttribute(p.attributes.NORMAL, 3)); g.setAttribute('uv', new THREE.BufferAttribute(p.attributes.TEXCOORD_0, 2)); g.setAttribute('tangent', new THREE.BufferAttribute(p.attributes.TANGENT, 4)); g.setIndex(new THREE.BufferAttribute(p.index, 1)); return g; };
    const e = MAN.assets.sheep; setAnimalModel({ sp: 'sheep' as Species, lods: [geo('lod0'), geo('lod1')], albedo: new THREE.Texture(), nrm: new THREE.Texture(), lod1At: e.lod1At, tris: e.tris });
    const A = new Animals(64), M = new THREE.Matrix4();
    A.begin(0, { x: 0, y: 1.6, z: 0 });
    for (let i = 0; i < 10; i++) A.push({ sp: 'sheep', x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0.3 }, M.makeTranslation(i * 5, 0, 0));
    A.end(); const s = A.stats();
    const far = Array.from({ length: 10 }, (_, i) => Math.hypot(i * 5, 1.6) > e.lod1At).filter(Boolean).length;
    expect(s.modelled).toBe(10); expect(s.draws).toBe(far && far < 10 ? 2 : 1); expect(s.triangles).toBe((10 - far) * e.tris[0] + far * e.tris[1]);
    clearAnimalModels();
  });
});
describe('the gaits and the poll joint (D-326 round 2, Q-980)', () => {
  it('the trot moves the diagonal pairs together, the gallop the fore pair and the hind pair a beat apart; the walk is unchanged', async () => {
    const { gaitOffset, gaitW, animalFrame, GALLOP_LEAD } = await import('../src/people/animals');
    const W = [0, Math.PI / 2, Math.PI, 1.5 * Math.PI], fore = [0, 1, 0, 1]; // LH, LF, RH, RF
    const at = (g: number) => W.map((w, i) => ((gaitOffset(w, fore[i], gaitW(g)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    expect(at(0)).toEqual(W);
    const t = at(1); expect(t[1]).toBeCloseTo(t[2]); expect(t[0]).toBeCloseTo(t[3]); expect(Math.abs(t[0] - t[1])).toBeCloseTo(Math.PI);
    // (s18 C14 D-790: the transverse gallop: each pair's right leg lands GALLOP_LEAD after its left, the pairs half a cycle apart)
    const h = at(2); expect(h[3] - h[1]).toBeCloseTo(GALLOP_LEAD); expect(h[2] - h[0]).toBeCloseTo(GALLOP_LEAD); expect(Math.abs(h[0] - h[1])).toBeCloseTo(Math.PI);
    // the equids carry their heads steep at rest (0.95 rad) and the poll straightens it when they graze
    const F = animalFrame('horse'); expect(Math.asin(-F.hd.y)).toBeCloseTo(0.95); expect(F.bend).toBeGreaterThan(0.35);
  });
});
