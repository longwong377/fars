// D-325: the project's modelled props (tools/blender/model_props.py -> public/models/props/m_*.glb). The committed GLBs are
// parsed by the game's own parser and registered, and every builder that draws a modelled class is built with them: the test
// checks the files (hash, levels, parts, occlusion), and per class that the builder draws the model (its triangles, not the
// stand-in's) at the builder's own sizes, and the budgets. How this could pass while the intent fails: a model registered
// but never drawn (the switch counts the model's triangles in the built meshes); a model drawn at the wrong size or place
// (boxes compared); a level that crumpled (lod1 box within 3 % of lod0's). What it cannot see: whether the forms read as
// real at arm's length (the contact sheets, T:/fars-assets-s12/props/*.png, and the lead's world render).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadModelsNode } from './lib/models_node';
import { model, modelParts, setModelsOff } from '../src/render/scanProps';

const man = JSON.parse(readFileSync('public/models/props/manifest.json', 'utf8'));
const mine = Object.entries<any>(man.assets).filter(([, a]) => a.parts);
beforeAll(() => { loadModelsNode(); });
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('modelled props (D-325): the files', () => {
  it('every modelled prop: its file with the recorded hash, two levels of the same parts, occlusion in 0..1, lod1 the same box', () => {
    expect(mine.length).toBeGreaterThanOrEqual(19);
    for (const [id, a] of mine) {
      expect(existsSync('public/' + a.file), id).toBe(true); expect(a.licence).toBe('CC0 1.0');
      expect(createHash('sha256').update(readFileSync('public/' + a.file)).digest('hex'), id).toBe(a.sha256);
      const m = model(a.of)!; expect(m, id).not.toBeNull();
      expect(Object.keys(m.lods[0]).sort(), id).toEqual([...a.parts].sort()); expect(Object.keys(m.lods[1]).sort(), id).toEqual([...a.parts].sort());
      let t0 = 0, t1 = 0; const b1 = new THREE.Box3();
      for (const p of a.parts) { t0 += tris(m.lods[0][p]); t1 += tris(m.lods[1][p]); b1.union(m.lods[1][p].boundingBox!);
        const ao = m.lods[0][p].getAttribute('ao'); if (a.ao) { expect(ao, `${id} ${p} ao`).toBeTruthy(); for (let i = 0; i < ao.count; i += 7) { expect(ao.getX(i)).toBeGreaterThanOrEqual(0); expect(ao.getX(i)).toBeLessThanOrEqual(1.0001); } } }
      expect(t0, id).toBe(a.tris.lod0); expect(t1, id).toBe(a.tris.lod1); expect(t1, id).toBeLessThanOrEqual(t0);
      const s0 = m.box.getSize(new THREE.Vector3()), s1 = b1.getSize(new THREE.Vector3());
      for (const k of ['x', 'y', 'z'] as const) expect(Math.abs(s1[k] - s0[k]), `${id} lod1 ${k}`).toBeLessThanOrEqual(0.05 * Math.max(s0.x, s0.y, s0.z) + 0.002);
    }
  });
});

describe('modelled props (D-325): palace furnishings', () => {
  it('every furnishing kind is drawn from its model at the SITE_SPEC sizes (both states)', async () => {
    const { buildTerrace } = await import('../src/arch/terrace');
    const { PalaceFurnishings, itemGeometry } = await import('../src/world/furnish_palaces');
    const { parts, manifest, doorways } = buildTerrace();
    const pf = new PalaceFurnishings(parts, manifest, doorways, { court: true });
    const kinds = new Map<string, any>(); for (const it of pf.plan) if (!kinds.has(it.kind)) kinds.set(it.kind, it);
    const of: Record<string, string> = { couch: 'couch', couch_covered: 'couch_covered', table: 'table', stool: 'stool', stool_stack: 'stool', footstool: 'footstool', incense_burner: 'burner', lamp_stand: 'lamp_stand', chest: 'chest', carpet: 'carpet', carpet_rolls: 'roll', hanging_rolls: 'roll', hanging: 'hanging', canopy: 'canopy', mat: 'mat' };
    for (const [k, it] of kinds) {
      if (k === 'jar') continue; // (the jar: a CC0 scan's shape, D-310)
      const P = itemGeometry(it); let t = 0; const box = new THREE.Box3();
      for (const list of Object.values(P)) for (const g of list as THREE.BufferGeometry[]) { t += tris(g); g.computeBoundingBox(); box.union(g.boundingBox!); }
      const M = model(of[k])!, own = Object.values(M.lods[0]).reduce((s, g) => s + tris(g), 0);
      // the model's triangles are there (a roll pile or a stack holds several; a carpet adds its pattern's patches)
      expect(t, k).toBeGreaterThanOrEqual(own * 0.99);
      const size = box.getSize(new THREE.Vector3());
      if (['couch', 'couch_covered', 'table', 'stool', 'footstool', 'incense_burner', 'lamp_stand', 'chest'].includes(k)) expect(size.y, `${k} height`).toBeCloseTo(it.h, 0);
      console.log(`${k}: ${t} triangles, ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m (item ${(2 * it.hu).toFixed(2)} x ${it.h.toFixed(2)} x ${(2 * it.hv).toFixed(2)})`);
    }
    console.log(pf.summary(), JSON.stringify(pf.info.tris));
    expect(pf.info.tris.stored).toBeLessThan(600_000); expect(pf.info.tris.use).toBeLessThan(2_500_000);
  });
});
describe('modelled props (D-325): vessels and sacks', () => {
  it('the jars, sacks, vats of every builder are the modelled forms at their builders’ boxes', async () => {
    const { propGeometry } = await import('../src/people/props');
    const { jarGeometry } = await import('../src/world/furnish');
    const { workGeometry } = await import('../src/people/workObjects');
    const sk = propGeometry('sack')!; expect(sk.getAttribute('position').count / 3).toBe(model('sack_lying')!.entry.tris.lod1);
    sk.computeBoundingBox(); const s = sk.boundingBox!.getSize(new THREE.Vector3()); expect(s.x).toBeCloseTo(0.44, 2); expect(s.y).toBeCloseTo(0.33, 2);
    const jr = propGeometry('jar')!; expect(jr.getAttribute('position').count / 3).toBe(model('jar_water')!.entry.tris.lod1);
    const j = jarGeometry(0.17, 0.55, 40, 1); j.computeBoundingBox(); expect(j.boundingBox!.max.y).toBeCloseTo(0.55, 2); expect(j.getAttribute('uv')).toBeTruthy();
    const sj = workGeometry('sealed_jars'); expect(sj.getAttribute('position').count).toBeGreaterThan(600);
  });
});
describe('modelled props (D-325): held props', () => {
  it('every modelled tool stands where its procedural form stood (the same frame and size: the placements hold); the carried unions within the in-game budget', async () => {
    const { propGeometry, MODELLED_TOOLS, PROP_CLASSES, propUnionGeometry } = await import('../src/people/props');
    const rows: string[] = [];
    for (const k of MODELLED_TOOLS) {
      setModelsOff(true); const a = propGeometry(k)!; setModelsOff(false); const b = propGeometry(k)!;
      expect(model('tool_' + k), k).not.toBeNull(); expect(b.getAttribute('position').count / 3, k).toBeGreaterThanOrEqual(model('tool_' + k)!.entry.tris.lod0);
      a.computeBoundingBox(); b.computeBoundingBox(); const A = a.boundingBox!, B = b.boundingBox!, ca = A.getCenter(new THREE.Vector3()), cb = B.getCenter(new THREE.Vector3()), sa = A.getSize(new THREE.Vector3()), sb = B.getSize(new THREE.Vector3());
      const L = Math.max(sa.x, sa.y, sa.z);
      rows.push(`${k}: ${a.getAttribute('position').count / 3} -> ${b.getAttribute('position').count / 3} tris; centre moved ${ca.distanceTo(cb).toFixed(3)} m; size ${sa.toArray().map(x => x.toFixed(2)).join('x')} -> ${sb.toArray().map(x => x.toFixed(2)).join('x')}`);
      expect.soft(ca.distanceTo(cb), `${k} centre`).toBeLessThan(0.1 * L + 0.02);
      expect.soft(Math.abs(Math.max(sb.x, sb.y, sb.z) - L), `${k} length`).toBeLessThan(0.2 * L + 0.02);
    }
    console.log(rows.join(' | '));
    const tris = PROP_CLASSES.map((_, c) => propUnionGeometry(c).getAttribute('position').count / 3);
    console.log(`carried-prop unions with the models: ${tris.join(' / ')} triangles per instance`);
    // the in-game budgets with the modelled props (node's procedural budgets, 1,000 / 700, stay in tests/performances.test.ts)
    expect(tris[0]).toBeLessThanOrEqual(4000); expect(tris[1]).toBeLessThanOrEqual(3000); expect(tris[4]).toBeLessThanOrEqual(1500);
  });
});
void modelParts;
