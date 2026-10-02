// D-570 (s17 C3; Vagon's first train, 21:40): WebGPU on the T4 allows 16 vertex inputs per pipeline, and the starlings' morphing
// flying level used 17 ("nodeAttribute7 has a location (16) that exceeds the maximum (16)"): nothing drew. Every life pipeline
// (the birds of wildlife.ts with every model loaded, the jackals, the small life, the fauna's Animals with a modelled species) is
// counted here, conservatively: every attribute its geometry carries is a location (a vec4 or less is one), the instance matrix
// four and the instance colour one when they are too many for a uniform buffer (as three does). The limit: 16.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { parseLifeGLB, setLifeModel, clearLifeModels } from '../src/world/lifeModels';
import { BIRDS, BIRD_VARIANTS, Birds, Jackals } from '../src/world/wildlife';
import { SmallLife } from '../src/world/smallLife';
import { Animals, type Species } from '../src/people/animals';
import { setAnimalModel, clearAnimalModels } from '../src/people/animalModels';
import { NavGrid } from '../src/people/navgrid';
import { Terrain, Ring, type TerrainMeta } from '../src/terrain/heightfield';
// @ts-ignore (plain JS: the Blender pipeline's GLB reader)
import { parseGLB, glbContent } from '../tools/blender/lib/glb.mjs';

export const MAX_VERTEX_INPUTS = 16, UNIFORM_LIMIT = 65536;
/** the vertex inputs a mesh's pipeline can bind (conservative: every geometry attribute) */
export function vertexInputs(m: THREE.Mesh): number {
  let n = Object.keys(m.geometry.attributes).length;
  // (three's InstanceNode: the matrices go in a uniform buffer while they fit its limit, 64 KiB on the T4 and in the tests,
  // else as four vec4 vertex inputs; the instance colours likewise, as one: the starlings' 1,500 are what overflowed)
  const im = m as THREE.InstancedMesh; if (im.isInstancedMesh) { const k = im.instanceMatrix.count; if (k * 64 > UNIFORM_LIMIT) n += 4; if (im.instanceColor && k * 12 > UNIFORM_LIMIT) n += 1; }
  return n;
}
const over = (g: THREE.Object3D) => { const bad: string[] = []; let worst = 0; g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const k = vertexInputs(m); worst = Math.max(worst, k); if (k > MAX_VERTEX_INPUTS) bad.push(`${m.name}: ${k} (${Object.keys(m.geometry.attributes).join(', ')})`); }); return { bad, worst }; };

describe('every life pipeline stays within 16 vertex inputs (D-570; the T4 limit)', () => {
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
  const terrain = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const MAN = JSON.parse(readFileSync('public/models/life/manifest.json', 'utf8'));
  const load = (id: string) => parseLifeGLB(new Uint8Array(readFileSync(`public/models/life/${id}.glb`)).buffer);
  it('the birds, every species and level with its model (the starlings among them), and the jackals', () => {
    clearLifeModels(); for (const id of Object.keys(MAN.assets)) if (existsSync(`public/models/life/${id}.glb`)) setLifeModel({ id, entry: MAN.assets[id], levels: load(id), albedo: null, nrm: null });
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const B = new Birds(1, nav, terrain, [[0, 90], [150, 40]]); const r = over(B.group);
    expect(B.meshesOf('starling').length).toBeGreaterThan(0); expect(Object.keys(BIRDS).flatMap(k => BIRD_VARIANTS[k] ?? [k]).length).toBeGreaterThan(20);
    expect(r.bad, `worst ${r.worst}`).toEqual([]);
    // (headroom: the trees on the GPU box add inputs this one does not see (the train counted 17 where this counted 14), so the
    // birds keep four spare)
    expect(r.worst, 'the birds keep four inputs spare').toBeLessThanOrEqual(MAX_VERTEX_INPUTS - 4);
    const J = new Jackals(1, terrain); expect(vertexInputs(J.mesh)).toBeLessThanOrEqual(MAX_VERTEX_INPUTS);
    const S = new SmallLife(7, { ground: () => 0, ctxAt: () => 'steppe' } as any); expect(over((S as any).group).bad).toEqual([]);
  });
  it('the fauna\'s animals with a modelled species (position, normal, tangent, uv and the rig)', async () => {
    if (!existsSync('public/models/animals/sheep.glb')) return;
    const buf = readFileSync('public/models/animals/sheep.glb'), { json } = parseGLB(buf), cg: any = await glbContent(buf), c: any = {};
    for (const g of cg.geo) { const m = json.meshes.find((x: any) => x.name === g.mesh), names = Object.keys(m.primitives[0].extensions.KHR_draco_mesh_compression.attributes), attributes: any = {};
      names.forEach((n, i) => { attributes[n] = g.parts[i]; }); c[g.mesh] = { attributes, index: Uint32Array.from(g.parts[names.length]) }; }
    const geo = (name: string) => { const p = c[name], g = new THREE.BufferGeometry(); for (const [k, nm, sz] of [['POSITION', 'position', 3], ['NORMAL', 'normal', 3], ['TEXCOORD_0', 'uv', 2], ['TANGENT', 'tangent', 4]] as const) if (p.attributes[k]) g.setAttribute(nm, new THREE.BufferAttribute(p.attributes[k], sz)); if (p.index) g.setIndex(new THREE.BufferAttribute(p.index, 1)); return g; };
    const MANA = JSON.parse(readFileSync('public/models/animals/manifest.json', 'utf8')), e = MANA.assets.sheep;
    clearAnimalModels(); setAnimalModel({ sp: 'sheep' as Species, lods: [geo('lod0'), geo('lod1')], albedo: new THREE.Texture(), nrm: new THREE.Texture(), lod1At: e.lod1At, tris: e.tris });
    const A = new Animals(64), M = new THREE.Matrix4(); A.begin(0, { x: 0, y: 1.6, z: 0 } as any);
    for (let i = 0; i < 6; i++) A.push({ sp: 'sheep', x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0.3 } as any, M.makeTranslation(i * 30, 0, 0));
    for (const sp of ['dog', 'horse', 'donkey', 'camel'] as Species[]) A.push({ sp, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0.3 } as any, M.makeTranslation(5, 0, 5));
    A.end(); const r = over(A.group); expect(r.bad, `worst ${r.worst}`).toEqual([]);
  });
});
