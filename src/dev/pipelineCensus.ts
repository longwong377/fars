// dev (s18 C9, D-740): the page's pipelines counted without compiling one. On a built world (?norender is enough: nothing is
// drawn or uploaded), every mesh of the scene is grouped by what makes three build a distinct shader (its material, its
// geometry's attributes, instanced / batched / skinned, the instance count against the uniform limit) and one of each group is
// put through three's own node builder as the scene pass builds it (the G-buffer's velocity output on, the scene's lights,
// environment and fog). From the WGSL: the shader programs (distinct vertex + fragment pairs), each pipeline's vertex inputs,
// vertex buffers and fragment samplers against WebGPU's 16 / 8 / 16 (a pipeline over any is not drawn on the T4), and the
// textures it binds with their GPU bytes (KTX2 as transcoded; images as RGBA8 with mips). Groups by the world's top-level
// object names, so a merge's growth shows where it came from.
//   __parsa.census()  (main.ts; tools/dev/pipeline_census.mjs drives it on the built site)
import * as THREE from 'three/webgpu';
import { mrt, output, velocity, vec4 } from 'three/tsl';

const LIM = { inputs: 16, buffers: 8, samplers: 16 };
/** a texture's GPU bytes: compressed mips as they are; others width x height x 4 (x 4/3 with mips), x layers */
export function textureBytes(t: any): number {
  if (t.isCompressedTexture || t.isCompressedArrayTexture) { let b = 0; for (const m of t.mipmaps ?? []) b += m?.data?.byteLength ?? 0;
    if (b) return b; const w = t.image?.width ?? 0, h = t.image?.height ?? 0, d = t.image?.depth ?? 1; return Math.round(w * h * d * 1.34); } // (data released: BC7's 1 byte a texel)
  const im = t.image ?? {}, w = im.width ?? im.videoWidth ?? 0, h = im.height ?? im.videoHeight ?? 0, d = im.depth ?? 1;
  const bpp = t.type === THREE.FloatType ? 16 : t.type === THREE.HalfFloatType ? 8 : t.format === THREE.RedFormat ? (t.type === THREE.UnsignedByteType ? 1 : 4) : 4;
  return Math.round(w * h * d * bpp * (t.generateMipmaps || t.mipmaps?.length ? 4 / 3 : 1));
}
const top = (o: THREE.Object3D, scene: THREE.Object3D) => { const p: string[] = []; let x: any = o; while (x && x !== scene) { p.unshift(x.name || x.type); x = x.parent; } return p.slice(0, 2).join('/'); };
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };

export async function pipelineCensus(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, o: { limit?: number; budgetMs?: number } = {}) {
  const R: any = renderer, nodes = R._nodes, groups = new Map<string, { mesh: THREE.Mesh; n: number; where: Set<string> }>();
  const unifLimit = R.backend?.capabilities?.getUniformBufferLimit?.() ?? 65536;
  scene.traverse(x => { const m = x as THREE.Mesh; if (!(m.isMesh || (m as any).isLine || (m as any).isPoints || (m as any).isSprite)) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]) { if (!mat) continue;
      const g: any = m.geometry, attrs = Object.keys(g?.attributes ?? {}).sort().join(','), im: any = m as any;
      const kind = `${im.isInstancedMesh ? 'I' + (im.instanceMatrix.count * 64 > unifLimit ? 'a' : 'u') + (im.instanceColor ? 'c' : '') : ''}${im.isBatchedMesh ? 'B' : ''}${im.isSkinnedMesh ? 'S' : ''}${g?.morphAttributes && Object.keys(g.morphAttributes).length ? 'M' : ''}`;
      const k = `${mat.uuid}|${attrs}|${kind}|${mat.side}`, e = groups.get(k); const w = top(m, scene);
      if (e) { e.n++; e.where.add(w); } else groups.set(k, { mesh: m, n: 1, where: new Set([w]) }); } });
  const prevMRT = R.getMRT?.() ?? null; R.setMRT(mrt({ output, velocity: vec4(velocity as any, 0, 1) }));
  const programs = new Map<string, number>(), vsSet = new Set<string>(), fsSet = new Set<string>(), over: any[] = [], byWhere: Record<string, { groups: number; programs: Set<string> }> = {};
  const tex = new Map<any, { bytes: number; name: string; where: Set<string> }>();
  let built = 0, failed = 0, worstIn = 0, worstBuf = 0, worstSmp = 0; const fails: string[] = []; const t0 = performance.now();
  const lights = R.lighting.getNode(scene, camera);
  for (const [k, e] of groups) {
    if (o.limit && built >= o.limit) break;
    const m = e.mesh, mat = (Array.isArray(m.material) ? m.material.find((x: any) => k.startsWith(x.uuid)) : m.material) as any;
    try {
      const b: any = R.backend.createNodeBuilder(m, R); b.scene = scene; b.material = mat; b.camera = camera; b.context.material = mat; b.lightsNode = lights;
      b.environmentNode = nodes.getEnvironmentNode?.(scene) ?? null; b.fogNode = nodes.getFogNode?.(scene) ?? null; b.build(); built++;
      const vs: string = b.vertexShader ?? '', fs: string = b.fragmentShader ?? '', params = (vs.split(/fn main\s*\(/)[1] ?? '').split(/\)\s*->/)[0];
      const inputs = (params.match(/@location\(/g) ?? []).length, extra = (params.match(/nodeAttribute\d+/g) ?? []).length;
      const buffers = new Set(Object.values((m.geometry as any).attributes ?? {}).map((a: any) => (a.isInterleavedBufferAttribute ? a.data : a))).size + Math.ceil(extra / 4);
      const samplers = (fs.match(/: sampler[;\s]|: sampler_comparison/g) ?? []).length;
      worstIn = Math.max(worstIn, inputs); worstBuf = Math.max(worstBuf, buffers); worstSmp = Math.max(worstSmp, samplers);
      const name = `${m.name || m.type}:${mat.name || mat.type}`;
      if (inputs > LIM.inputs || buffers > LIM.buffers || samplers > LIM.samplers) over.push({ name, where: [...e.where].slice(0, 3), inputs, buffers, samplers, attrs: Object.keys((m.geometry as any).attributes) });
      const pk = hash(vs) + '/' + hash(fs); programs.set(pk, (programs.get(pk) ?? 0) + 1); vsSet.add(hash(vs)); fsSet.add(hash(fs));
      for (const w of e.where) { const x = byWhere[w] ??= { groups: 0, programs: new Set() }; x.groups++; x.programs.add(pk); }
      for (const bind of b.getBindings?.() ?? []) for (const u of bind.bindings ?? []) { const t = u.texture; if (!t?.isTexture || t.isRenderTargetTexture || t.isDepthTexture) continue;
        const r = tex.get(t) ?? { bytes: textureBytes(t), name: t.name || (t.image?.src ?? '').split('/').slice(-2).join('/') || `${t.constructor?.name} ${t.image?.width}x${t.image?.height}`, where: new Set<string>() }; for (const w of e.where) r.where.add(w); tex.set(t, r); }
    } catch (err) { failed++; if (fails.length < 12) fails.push(`${m.name}:${mat?.name}: ${String((err as Error)?.message ?? err).slice(0, 100)}`); }
    if (o.budgetMs && performance.now() - t0 > o.budgetMs) break;
    if (built % 25 === 0) await new Promise(r => setTimeout(r, 0));
  }
  R.setMRT(prevMRT);
  const T = [...tex.values()], texMB = T.reduce((s, t) => s + t.bytes, 0) / 1048576, byTexWhere: Record<string, number> = {};
  for (const t of T) { const w = [...t.where][0]?.split('/')[0] ?? '?'; byTexWhere[w] = (byTexWhere[w] ?? 0) + t.bytes / 1048576; }
  return {
    meshGroups: groups.size, built, failed, fails, ms: Math.round(performance.now() - t0),
    programs: programs.size, vertexModules: vsSet.size, fragmentModules: fsSet.size,
    worst: { inputs: worstIn, buffers: worstBuf, samplers: worstSmp }, over,
    byWhere: Object.fromEntries(Object.entries(byWhere).map(([k, v]) => [k, { groups: v.groups, programs: v.programs.size }] as const).sort((a, b) => b[1].programs - a[1].programs).slice(0, 40)),
    textures: { count: T.length, MB: +texMB.toFixed(1), byWhere: Object.fromEntries(Object.entries(byTexWhere).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +v.toFixed(1)])),
      top: T.sort((a, b) => b.bytes - a.bytes).slice(0, 30).map(t => `${t.name} ${(t.bytes / 1048576).toFixed(1)} MB`) },
  };
}
