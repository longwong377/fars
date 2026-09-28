// D-332 (BLENDER_PLAN rows 13, 20): the modelled small life. Every bird species of wildlife.ts BIRDS (and its flocks'
// variants), every small creature of smallLife.ts SMALL and every ground-flora kind has a built model in
// public/models/life/ (a plain GLB with its levels, two KTX2 maps), within its triangle budget; the birds' models match the
// game's own sizes, fly nose-first, and stand with their feet on the ground.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import { parseLifeGLB, setLifeModel, clearLifeModels, levelTris, type LifeAsset } from '../src/world/lifeModels';
import { BIRDS, BIRD_VARIANTS, Birds, swallowAt, type BirdPose } from '../src/world/wildlife';
import { NavGrid } from '../src/people/navgrid';
import { Terrain, Ring, type TerrainMeta } from '../src/terrain/heightfield';

const MAN = JSON.parse(readFileSync('public/models/life/manifest.json', 'utf8')) as { assets: Record<string, LifeAsset> };
const birdIds = Object.keys(BIRDS).flatMap(k => BIRD_VARIANTS[k] ?? [k]);
/** the budgets (C): a bird's nearest level under 800 triangles (BLENDER_PLAN row 20 asked ~200 at the far distances: the far
 *  level is under 80), the level beyond BIRD_LOD[0] x its length under 200 */
const BIRD_TRIS = { fly0: 800, fly1: 200, fly2: 80, stand0: 800, stand1: 200 };
const load = (id: string) => parseLifeGLB(new Uint8Array(readFileSync(`public/models/life/${id}.glb`)).buffer);

describe('the modelled birds (D-332)', () => {
  it('every species and variant is built, its files match the manifest, its levels are in budget', () => {
    for (const id of birdIds) {
      const e = MAN.assets[id]; expect(e, id).toBeTruthy(); expect(e.class).toBe('birds');
      for (const [f, m] of Object.entries(e.files)) { const b = readFileSync(`public/models/life/${f}`); expect(b.length, f).toBe(m.bytes); expect(createHash('sha256').update(b).digest('hex'), f).toBe(m.sha256); }
      const L = load(id); for (const k of ['fly0', 'fly1', 'fly2']) expect(L[k], `${id} ${k}`).toBeTruthy();
      for (const [k, g] of Object.entries(L)) { expect(levelTris(g), `${id} ${k}`).toBeLessThanOrEqual(BIRD_TRIS[k as keyof typeof BIRD_TRIS]); expect(g.getAttribute('uv'), `${id} ${k} uv`).toBeTruthy(); }
      expect(L.fly0.getAttribute('life'), `${id} wing weights`).toBeTruthy();
    }
  });
  it('each model is the game\'s own size: its span and length as BIRDS gives them', () => {
    for (const k of Object.keys(BIRDS) as (keyof typeof BIRDS)[]) for (const id of BIRD_VARIANTS[k] ?? [k]) {
      const b = load(id).fly0.boundingBox!, sp = BIRDS[k];
      expect(b.max.x - b.min.x, `${id} span`).toBeCloseTo(sp.span * (id === 'swift' ? 0.4 / 0.36 : 1), 2);
      expect(MAN.assets[id].L, `${id} length`).toBeCloseTo(sp.length, 3);
    }
  });
  it('the ground birds have standing levels with their feet at y = 0 and wings folded (narrower than the span)', () => {
    for (const id of ['sparrow', 'crow', 'dove', 'stork', 'heron', 'egret', 'chukar', 'hoopoe', 'magpie', 'wheatear', 'owl', 'bulbul', 'duck']) {
      const L = load(id); expect(L.stand0, id).toBeTruthy(); const b = L.stand0.boundingBox!, f = L.fly0.boundingBox!;
      expect(b.min.y, id).toBeCloseTo(0, 3); expect(b.max.x - b.min.x, id).toBeLessThan(0.45 * (f.max.x - f.min.x));
    }
  });
  describe('in the world', () => {
    let B: Birds;
    beforeAll(() => {
      clearLifeModels(); for (const id of birdIds) setLifeModel({ id, entry: MAN.assets[id], levels: load(id), albedo: null, nrm: null });
      const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
      const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
      const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
      B = new Birds(1, nav, new Terrain(meta, ring('near'), ring('mid'), ring('far')), [[0, 90], [150, 40]]);
    });
    it('draws the models, not the stand-in (no mesh flagged PLACEHOLDER), and the swifts as swifts', () => {
      expect(B.group.children.filter(m => (m as any).userData.placeholder)).toHaveLength(0);
      B.update(5, 19.2, 1000, [0, 60], { x: 0, n: 0 }, 0); // (June at dusk: the swifts scream round the halls)
      const sw = B.meshesOf('swallow').filter(m => m.name.startsWith('bird-swift') && m.count > 0); expect(sw.length).toBeGreaterThan(0);
    });
    it('a bird flies nose first: the model\'s +z turned by the instance matrix points along its path', () => {
      const a: BirdPose = { pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false }, b = { ...a, pos: new THREE.Vector3() };
      for (const t of [10, 55, 130, 400]) {
        swallowAt([0, 0], 0, 5, t, a); swallowAt([0, 0], 0, 5, t + 0.05, b);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI - a.heading, 0, 'YXZ')), nose = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const v = new THREE.Vector3().subVectors(b.pos, a.pos).setY(0).normalize(); expect(nose.dot(v), `t ${t}`).toBeGreaterThan(0.9);
      }
    });
    it('a sparrow on the ground is drawn standing; the far birds with their far levels', () => {
      B.update(5, 11, 2000, [0, 90], { x: 0, n: 0 }, 0);
      expect(B.meshesOf('sparrow').filter(m => m.name.includes(':stand')).reduce((s, m) => s + m.count, 0)).toBeGreaterThan(0);
      const far = B.meshesOf('raptor').filter(m => m.name.endsWith('fly2')).reduce((s, m) => s + m.count, 0), near = B.meshesOf('raptor').filter(m => m.name.endsWith('fly0')).reduce((s, m) => s + m.count, 0);
      expect(far + near).toBe(B.countOf('raptor')); expect(far).toBeGreaterThan(0);
    });
    it('the drawn triangles stay in budget with every species at its full count and at its nearest level (the worst case)', () => {
      let tris = 0; for (const k of Object.keys(BIRDS) as (keyof typeof BIRDS)[]) { const m = MAN.assets[(BIRD_VARIANTS[k] ?? [k])[0]]; tris += BIRDS[k].count * (k === 'starling' ? m.tris.fly2 : m.tris.fly0); }
      expect(tris).toBeLessThan(400_000); // (the starlings' murmuration is seen from hundreds of metres: its far level)
    });
  });
});
void existsSync;

import { SmallLife, SMALL, type CellCtx } from '../src/world/smallLife';
describe('the modelled small creatures (D-332)', () => {
  it('every kind is built at the game\'s length, its levels in budget (lod0 <= 1600, lod1 <= 400 triangles)', () => {
    for (const k of Object.keys(SMALL)) {
      const e = MAN.assets[k]; expect(e, k).toBeTruthy(); expect(e.class).toBe('small'); expect(e.L, k).toBeCloseTo(SMALL[k as keyof typeof SMALL].length, 4);
      const L = load(k); expect(levelTris(L.lod0), k).toBeLessThanOrEqual(1600); expect(levelTris(L.lod1), k).toBeLessThanOrEqual(400); expect(L.lod0.getAttribute('uv')).toBeTruthy();
      const b = L.lod0.boundingBox!; expect(Math.max(b.max.z - b.min.z, b.max.x - b.min.x), k).toBeGreaterThan(0.6 * e.L!); expect(Math.max(b.max.z - b.min.z, b.max.x - b.min.x), k).toBeLessThan(3.6 * e.L!);
      if (!['fly', 'dragonfly', 'butterfly'].includes(k)) expect(Math.abs(b.min.y), `${k} stands on the ground`).toBeLessThan(0.002);
    }
  });
  it('with the models: no stand-in drawn, near and far levels by distance, the worst case under 400 k triangles', () => {
    clearLifeModels(); for (const k of [...Object.keys(SMALL), 'flower_violet', 'flower_yellow', 'flower_red', 'flower_crown']) setLifeModel({ id: k, entry: MAN.assets[k], levels: load(k), albedo: null, nrm: null });
    const ctxAt = (e: number, n: number): CellCtx => Math.hypot(e, n) < 6 ? 'midden' : Math.abs(n - 40) < 6 ? 'water' : e > 60 ? 'rock' : e < -40 ? 'field' : 'steppe';
    const s = new SmallLife(7, { ground: () => 0, ctxAt }); expect(s.group.children.filter(m => (m as any).userData.placeholder)).toHaveLength(0);
    s.update(6, 12, 50000, [0, 20], 0, 2); expect(s.stats.fly).toBeGreaterThan(0); expect(s.far.get('fly')!.count + s.meshes.get('fly')!.count).toBe(s.stats.fly);
    let worst = 0; for (const [k, sp] of Object.entries(SMALL)) worst += sp.max * MAN.assets[k].tris.lod0; expect(worst).toBeLessThan(1_200_000);
    let drawnWorst = 0; for (const [k, sp] of Object.entries(SMALL)) drawnWorst += sp.max * MAN.assets[k].tris.lod1; expect(drawnWorst).toBeLessThan(400_000);
    clearLifeModels();
  });
});

import { GroundFlora, RoseBeds, FLORA } from '../src/world/groundFlora';
describe('the modelled ground flora (D-332)', () => {
  const ids = ['cushion', 'camelthorn', 'thistle', 'rose', 'flower_violet', 'flower_yellow', 'flower_red', 'flower_crown'];
  it('every kind is built at its unit size, within the D-310 scans\' budget (lod0 <= 1500, lod1 <= 300 triangles), with its flower parts marked', () => {
    for (const id of ids) {
      const e = MAN.assets[id]; expect(e, id).toBeTruthy(); expect(e.class).toBe('flora'); const L = load(id);
      expect(levelTris(L.lod0), id).toBeLessThanOrEqual(1500); expect(levelTris(L.lod1), id).toBeLessThanOrEqual(300);
      const b = L.lod0.boundingBox!; expect(b.max.y, id).toBeGreaterThan(0.4); expect(b.max.y, id).toBeLessThan(1.35); expect(b.min.y, id).toBeGreaterThan(-0.1);
      const part = L.lod0.getAttribute('life'); let f = 0; for (let i = 0; i < part.count; i++) f += part.getX(i) > 0.5 ? 1 : 0; expect(f, `${id} flowers`).toBeGreaterThan(0);
    }
  });
  it('with the models: no stand-in and no scan drawn, near and far levels, and the roses by distance', () => {
    clearLifeModels(); for (const id of ids) setLifeModel({ id, entry: MAN.assets[id], levels: load(id), albedo: null, nrm: null });
    const ctxAt = (e: number): CellCtx => (e > 100 ? 'rock' : e > 0 ? 'steppe' : 'field');
    const f = new GroundFlora(3, { ground: () => 0, ctxAt }); f.update(4, [50, 0]);
    for (const k of Object.keys(FLORA) as (keyof typeof FLORA)[]) { const M = f.model.get(k)!; expect(M, k).toBeTruthy(); expect(M.near.count + M.far.count, k).toBe(f.stats[k]); expect(f.meshes.get(k)!.visible).toBe(false); }
    expect(f.stats.thistle + f.stats.camelthorn).toBeGreaterThan(0);
    const r = new RoseBeds([{ e: 0, n: 0, y: 0, size: 1, rot: 0 }, { e: 80, n: 0, y: 0, size: 0.7, rot: 1 }]); r.update(5, [0, 0]);
    expect(r.group.children.filter(m => (m as any).userData.placeholder)).toHaveLength(0);
    const near = r.group.children.find(m => m.name === 'flora-roses:lod0') as THREE.InstancedMesh, far = r.group.children.find(m => m.name === 'flora-roses:lod1') as THREE.InstancedMesh;
    expect(near.count).toBe(1); expect(far.count).toBe(1);
    // the worst case drawn: every kind at its cap, the near share at lod0 (the area within FLORA_LOD_NEAR of the radius's disc)
    let tris = 0; for (const k of Object.keys(FLORA) as (keyof typeof FLORA)[]) { const e = MAN.assets[k]; tris += FLORA[k].max * (0.12 * e.tris.lod0 + 0.88 * e.tris.lod1); }
    expect(tris).toBeLessThan(1_000_000);
    clearLifeModels();
  });
});
