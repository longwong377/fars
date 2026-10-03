// D-740 (s18 C9): the T4's pipeline limits, counted on the WGSL three really builds (not on the geometry): WebGPU allows 16
// vertex inputs, 8 vertex buffers and 16 samplers per fragment stage, and a pipeline over any of them is not drawn at all.
// D-570's count (tests/vertex_inputs.test.ts) missed the previous frame's instance matrix that TRAA's velocity output adds
// (four more inputs when the matrices go as attributes: share-instancing, or past the uniform limit): it counted 14 where the
// T4 failed the starlings at 17. Here every bird level of every species with its model, the jackals and the small life are
// built by three's WGSLNodeBuilder in node with the page's conditions: the velocity MRT on, share-instancing on, a 64 KiB
// uniform limit (the T4's), stand-in textures for every life map. The page adds ~11 fragment samplers of its own (shadow
// maps, probes, environment: tests/samplers_d300), so a life material keeps to 5.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { mrt, output, velocity } from 'three/tsl';
import '../src/render/shareInstancing';
import { parseLifeGLB, setLifeModel, clearLifeModels } from '../src/world/lifeModels';
import { Birds, Jackals } from '../src/world/wildlife';
import { SmallLife } from '../src/world/smallLife';
import { NavGrid } from '../src/people/navgrid';
import { Terrain, Ring, type TerrainMeta } from '../src/terrain/heightfield';

const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export const LIMITS = { vertexInputs: 16, vertexBuffers: 8, fragmentSamplers: 16, nodeSamplers: 5 } as const;
/** a node-side WebGPU renderer that builds WGSL as the page does (velocity output on, the T4's uniform limit) */
export function wgslRenderer(velocityOn = true) {
  const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const r: any = new (THREE as any).WebGPURenderer({ canvas }); r.hasFeature = () => true;
  r.backend.capabilities = { getUniformBufferLimit: () => 65536 };
  if (velocityOn) r.setMRT(mrt({ output, velocity }));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true; scene.add(new THREE.HemisphereLight(), sun);
  return { r, scene, cam };
}
/** the vertex inputs, vertex buffers and fragment samplers of one mesh's pipeline, from its WGSL */
export function pipelineOf(o: THREE.Mesh, env: ReturnType<typeof wgslRenderer>) {
  const b = new (THREE as any).WGSLNodeBuilder(o, env.r); b.scene = env.scene; b.camera = env.cam; b.material = o.material; b.lightsNode = env.r.lighting.getNode(env.scene, env.cam); b.build();
  const vs: string = b.vertexShader, params = (vs.split(/fn main\s*\(/)[1] ?? '').split(/\)\s*->/)[0];
  const inputs = (params.match(/@location\(/g) ?? []).length;
  // (buffers: the geometry's distinct arrays, plus the matrices' and the previous matrices' interleaved buffers when the WGSL
  // reads them as attributes, plus an instance colour's)
  const names = [...params.matchAll(/@location\(\s*\d+\s*\)\s*(\w+)\s*:/g)].map(m => m[1]), extra = names.filter(n => /^nodeAttribute\d+$/.test(n)).length;
  // (only the attributes the WGSL reads are bound: three makes a vertex buffer per array the pipeline uses)
  const used = names.map(n => (o.geometry.attributes as any)[n]).filter(Boolean), geo = new Set(used.map((a: any) => (a.isInterleavedBufferAttribute ? a.data : a))).size;
  const buffers = geo + Math.ceil(extra / 4);
  const samplers = ((b.fragmentShader as string).match(/: sampler[;\s]|sampler_comparison/g) ?? []).length;
  return { inputs, buffers, samplers, program: `${vs.length}:${hashOf(vs)}/${(b.fragmentShader as string).length}:${hashOf(b.fragmentShader)}` };
}
const check = (g: THREE.Object3D, env: ReturnType<typeof wgslRenderer>) => {
  const bad: string[] = [], rows: string[] = []; let worst = 0;
  g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; const p = pipelineOf(m, env); worst = Math.max(worst, p.inputs); rows.push(`${m.name} ${p.inputs}/${p.buffers}/${p.samplers}`);
    if (p.inputs > LIMITS.vertexInputs || p.buffers > LIMITS.vertexBuffers || p.samplers > LIMITS.nodeSamplers) bad.push(`${m.name}: ${p.inputs} inputs, ${p.buffers} buffers, ${p.samplers} samplers`); });
  return { bad, rows, worst };
};

describe('every life pipeline fits the T4 (WGSL counted; D-740)', () => {
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
  const terrain = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const MAN = JSON.parse(readFileSync('public/models/life/manifest.json', 'utf8'));
  const loadAll = () => { clearLifeModels(); for (const id of Object.keys(MAN.assets)) if (existsSync(`public/models/life/${id}.glb`))
    setLifeModel({ id, entry: MAN.assets[id], levels: parseLifeGLB(new Uint8Array(readFileSync(`public/models/life/${id}.glb`)).buffer), albedo: new THREE.Texture(), nrm: new THREE.Texture() }); };
  it('the birds (the starlings and the doves among them), the jackals and the small life', () => {
    loadAll(); const env = wgslRenderer();
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const B = new Birds(1, nav, terrain, [[0, 90], [150, 40]]); const r = check(B.group, env);
    expect(B.meshesOf('starling').length).toBeGreaterThan(0); expect(B.meshesOf('dove').length).toBeGreaterThan(0);
    expect(r.bad, r.rows.join(', ')).toEqual([]);
    // the starlings' flying levels: 6 geometry inputs, the matrix and the previous frame's (8): 14 with the uv packed in life.zw (the T4 failed them at 17)
    for (const m of B.meshesOf('starling')) expect(pipelineOf(m as THREE.Mesh, env).inputs, (m as THREE.Mesh).name).toBeLessThanOrEqual(14);
    // (D-740: one shader for every species' flying level: the wingbeat's rate and shoulder are uniforms; the page counted 43
    // programs for the birds' 59 mesh groups: 2 now, the plain flight and the take-off morph)
    const progs = new Set<string>(); B.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && /:fly/.test(m.name)) progs.add(pipelineOf(m, env).program); });
    expect(progs.size, 'the flying birds\' programs').toBeLessThanOrEqual(2);
    const J = new Jackals(1, terrain); expect(check(J.mesh, env).bad).toEqual([]);
    const S = new SmallLife(7, { ground: () => 0, ctxAt: () => 'steppe' } as any); expect(check((S as any).group, env).bad).toEqual([]);
    clearLifeModels();
  }, 600_000);
  it('without the velocity output the same pipelines lose the previous matrix (the count is the WGSL\'s, not a guess)', () => {
    loadAll(); const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const B = new Birds(1, nav, terrain, [[0, 90], [150, 40]]), m = B.meshesOf('starling')[0] as THREE.Mesh;
    expect(pipelineOf(m, wgslRenderer(false)).inputs).toBe(pipelineOf(m, wgslRenderer(true)).inputs - 4);
    clearLifeModels();
  }, 600_000);
});
