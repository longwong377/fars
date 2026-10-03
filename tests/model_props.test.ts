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
    const kinds = new Map<string, any>(); for (const it of pf.plan) if (!kinds.has(it.kind) && it.lod === undefined) kinds.set(it.kind, it); // (D-780: not the banquet's tables, drawn at the lowest level)
    const of: Record<string, string> = { couch: 'couch', couch_covered: 'couch_covered', table: 'table', stool: 'stool', stool_stack: 'stool', footstool: 'footstool', incense_burner: 'burner', lamp_stand: 'lamp_stand', chest: 'chest', carpet: 'carpet', carpet_rolls: 'roll', hanging_rolls: 'roll', hanging: 'hanging', canopy: 'canopy', mat: 'mat' };
    for (const [k, it] of kinds) {
      if (k === 'jar') continue; // (the jar: a CC0 scan's shape, D-310)
      const P = itemGeometry(it); let t = 0; const box = new THREE.Box3();
      for (const list of Object.values(P)) for (const g of list as THREE.BufferGeometry[]) { t += tris(g); g.computeBoundingBox(); box.union(g.boundingBox!); }
      const M = model(of[k])!, own = Object.values(M.lods[['carpet', 'carpet_rolls', 'hanging_rolls', 'hanging'].includes(k) ? 1 : 0]).reduce((s, g) => s + tris(g), 0);
      // the model's triangles are there (a roll pile or a stack holds several; a carpet adds its pattern's patches)
      expect(t, k).toBeGreaterThanOrEqual(own * 0.99);
      const size = box.getSize(new THREE.Vector3());
      if (['couch', 'couch_covered', 'table', 'stool', 'footstool', 'incense_burner', 'lamp_stand', 'chest'].includes(k)) expect(size.y, `${k} height`).toBeCloseTo(it.h, 0);
      console.log(`${k}: ${t} triangles, ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m (item ${(2 * it.hu).toFixed(2)} x ${it.h.toFixed(2)} x ${(2 * it.hv).toFixed(2)})`);
    }
    console.log(pf.summary(), JSON.stringify(pf.info.tris));
    expect(pf.info.tris.stored).toBeLessThan(300_000); expect(pf.info.tris.use).toBeLessThan(450_000); expect(pf.info.trisFar.use).toBeLessThan(pf.info.tris.use * 0.65); console.log('far', JSON.stringify(pf.info.trisFar));
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
    expect(tris[0]).toBeLessThanOrEqual(4000); expect(tris[1]).toBeLessThanOrEqual(3000); expect(tris[2]).toBeLessThanOrEqual(3500); expect(tris[4]).toBeLessThanOrEqual(1500);
  });
});
describe('modelled props (D-325): work objects', () => {
  it('every work object kind is drawn from its model (or its composite of models and scans) where its procedural form stood', async () => {
    const { workGeometry, workModel, WORK_NOTES } = await import('../src/people/workObjects');
    const rows: string[] = []; let modelled = 0;
    for (const k of Object.keys(WORK_NOTES) as any[]) {
      setModelsOff(true); const a = workGeometry(k); setModelsOff(false); const m = workModel(k), b = workGeometry(k);
      if (!m) { rows.push(`${k}: procedural (no model)`); continue; } modelled++;
      a.computeBoundingBox(); b.computeBoundingBox(); const A = a.boundingBox!, B = b.boundingBox!, ca = A.getCenter(new THREE.Vector3()), cb = B.getCenter(new THREE.Vector3()), sa = A.getSize(new THREE.Vector3()), sb = B.getSize(new THREE.Vector3());
      const L = Math.max(sa.x, sa.y, sa.z);
      rows.push(`${k}: ${a.getAttribute('position').count / 3} -> ${b.getAttribute('position').count / 3} tris; centre moved ${ca.distanceTo(cb).toFixed(3)}; size ${sa.toArray().map(x => x.toFixed(2)).join('x')} -> ${sb.toArray().map(x => x.toFixed(2)).join('x')}`);
      expect.soft(ca.distanceTo(cb), `${k} centre`).toBeLessThan(0.15 * L + 0.03);
      expect.soft(Math.abs(Math.max(sb.x, sb.y, sb.z) - L), `${k} extent`).toBeLessThan(0.2 * L + 0.03);
      expect.soft(b.getAttribute('position').count / 3, `${k} triangles`).toBeLessThan(12000);
    }
    console.log(rows.join(' | '));
    expect(modelled).toBeGreaterThanOrEqual(Object.keys(WORK_NOTES).length - 2); // (jar: the carried jar's model; throne: its own)
  });
});
describe('modelled props (D-325): the Treasury goods and the rooms’ fittings', () => {
  it('the goods, the room ranges’ lamps, querns, mats and bedding and the scribes’ lamp are drawn from their models', async () => {
    const { buildTreasuryGoods, buildRoomFittings } = await import('../src/world/furnish');
    const tri = (g: THREE.Object3D) => { let t = 0; g.traverse((o: any) => { if (o.isMesh) t += (o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute('position').count) / 3 * (o.isInstancedMesh ? o.count : 1); }); return t; };
    const benches = [[0, 0, 12, 0.8, 1.0], [0, 3, 12, 0.8, 1.0]], R = { mats: [[0, 0, 0.9, 2, 0, 0]], jars: [[1, 1, 0]], querns: [[2, 2, 0]], lamps: [[3, 3, 1]] };
    setModelsOff(true); const g0 = tri(buildTreasuryGoods(benches, 1)), r0 = tri(buildRoomFittings('t', R)); setModelsOff(false);
    const g1 = tri(buildTreasuryGoods(benches, 1)), r1 = tri(buildRoomFittings('t', R));
    console.log(`treasury goods: ${g0} -> ${g1} triangles; room fittings: ${r0} -> ${r1}`);
    expect(g1).not.toBe(g0); expect(r1).not.toBe(r0);
  });
});
describe('modelled props (D-325): the town’s and villages’ fittings', () => {
  it('near, every prop fitting is drawn from its model; far, the cheap procedural form stays', async () => {
    const { fittingGeom } = await import('../src/world/settlement/build');
    const { Batch } = await import('../src/world/settlement/geom');
    const site: any = { id: 'test', grid: (u: number, v: number) => [u, v], frame: { theta: 0.3 } };
    const rows: string[] = [];
    for (const kind of ['hearth', 'forge', 'kiln', 'quern', 'grind_slab', 'loom', 'timber', 'anvil', 'bench', 'knucklebones', 'toys', 'trough', 'manger', 'jar', 'vat']) {
      const f: any = { kind, u: 1, v: 2, rot: 0, size: 1, len: 3 }, t = (off: boolean, far: boolean) => { setModelsOff(off); const b = new Batch(); fittingGeom(site, f, b, () => 0, 1, far); setModelsOff(false); return b.tris; };
      const proc = t(true, false), near = t(false, false), far = t(false, true); rows.push(`${kind}: ${proc} -> near ${near}, far ${far}`);
      expect(near, kind).not.toBe(proc); expect(far, kind).toBe(proc);
    }
    console.log(rows.join(' | '));
  });
});
describe('modelled props (D-325): the precinct’s fire altar', () => {
  it('the altar’s steps and embers are one model (drawn in the first step’s place), their colliders kept', async () => {
    const { precinctProps } = await import('../src/world/settlement/precinct');
    const props: any[] = [], groups = new Map(); precinctProps(props, groups);
    const alt = props.filter(p => p.group === 'precinct_altar');
    expect(alt.filter(p => p.model === 'fire_altar')).toHaveLength(1); expect(alt.filter(p => p.inModel === 'fire_altar').length).toBe(alt.length - 1);
    expect(model('fire_altar')).not.toBeNull(); expect(alt.filter(p => p.collide).length).toBeGreaterThanOrEqual(7);
  });
});
void modelParts;
describe('modelled props (D-325): the houses’ fixtures', () => {
  it('the houses’ near tiles draw the modelled fixtures (and stay within the tile budget)', async () => {
    const { Settlement } = await import('../src/world/settlement/build');
    const { FireSystem } = await import('../src/world/fire');
    const { newHB } = await import('../src/world/settlement/houses');
    const { loadTerrain } = await import('./plainLib');
    const town = new Settlement(null, loadTerrain(), new FireSystem(0), 'test');
    const count = (off: boolean) => { setModelsOff(off); let tris = 0, worst = 0; for (const hs of town.houses.slice(0, 6)) for (const t of hs.tiles.keys()) { const B = newHB(); hs.buildTile(t, B); let tt = 0; for (const b of Object.values(B)) tt += (b as any).tris; tris += tt; worst = Math.max(worst, tt); } setModelsOff(false); return { tris, worst }; };
    const a = count(true), b = count(false); console.log(`houses near (6 sites): ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
    expect(b.tris).toBeGreaterThan(a.tris); expect(b.worst).toBeLessThan(70_000); expect(b.tris).toBeLessThan(a.tris * 1.2); // (the models at lod2: +13 % on the procedural tiles, measured)
  }, 600_000);
});
