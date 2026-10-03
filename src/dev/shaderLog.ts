// dev (D-250, s17 D-473): which object and material each new render pipeline came from, and why. ?shaderlog on the page.
//  - window.__shaderLog: one row per new three.js render pipeline (object, material, pass, WGSL sizes); a row whose render
//    object had a pipeline before carries `re`: what changed in its key ('mat' the material's own key, 'dyn' the scene's
//    lights / environment / fog / context, 'geo' the geometry) and the lights key before/after;
//  - window.__gpuCount: the GPU device's own counts (shader modules, render pipelines sync + async, compute pipelines), so a
//    state change can be measured as "pipelines created" whatever three does.
// ?shaderlog=<regex> also keeps the WGSL of objects whose name matches.
import type * as THREE from 'three/webgpu';

export function installDeviceCounters() {
  const G: any = (globalThis as any).GPUDevice; if (!G || G.prototype.__counted) return;
  const C = (globalThis as any).__gpuCount = { modules: 0, pipes: 0, asyncPipes: 0, compute: 0 }, D = G.prototype; D.__counted = true;
  const wrap = (k: string, f: keyof typeof C) => { const o = D[k]; if (o) D[k] = function (this: any, ...a: any[]) { C[f]++; return o.apply(this, a); }; };
  wrap('createShaderModule', 'modules'); wrap('createRenderPipeline', 'pipes'); wrap('createRenderPipelineAsync', 'asyncPipes');
  wrap('createComputePipeline', 'compute'); wrap('createComputePipelineAsync', 'compute');
}

export function installShaderLog(renderer: THREE.WebGPURenderer, codeRe: string | null) {
  const pl: any = (renderer as any)._pipelines, orig = pl.getForRender.bind(pl), seen = new Set<any>(), log: any[] = (globalThis as any).__shaderLog = [];
  const keys = new WeakMap<any, { m: string; d: number; g: string; l: number | string }>();
  const re = codeRe ? new RegExp(codeRe) : null;
  pl.getForRender = (ro: any, pr: any) => {
    const r = orig(ro, pr);
    if (r && !seen.has(r)) {
      seen.add(r); const m = ro.material, o = ro.object;
      let k: { m: string; d: number; g: string; l: number | string } | undefined;
      try { k = { m: String(ro.getMaterialCacheKey()), d: ro.getDynamicCacheKey(), g: String(ro.geometry?.id), l: ro.lightsNode?.getCacheKey?.(true) ?? '-' }; } catch { /* (a shadow pass object) */ }
      const prev = keys.get(ro); if (k) keys.set(ro, k);
      const why = prev && k ? [prev.m !== k.m && 'mat', prev.d !== k.d && 'dyn', prev.g !== k.g && 'geo'].filter(Boolean).join('+') || 'same' : undefined;
      log.push({ t: Math.round(performance.now()), obj: o?.name || o?.parent?.name || o?.type, mat: m?.name || m?.type, note: String(m?.userData?.note ?? m?.userData?.surface ?? '').slice(0, 60),
        pass: ro.context?.depth === false ? 'nodepth' : (ro.context?.textures?.length ? 'mrt' + ro.context.textures.length : ''), shadow: !!m?.isShadowPassMaterial || String(ro.passId ?? ''),
        frag: r.fragmentProgram?.code?.length ?? 0, vert: r.vertexProgram?.code?.length ?? 0, fid: r.fragmentProgram?.id, vid: r.vertexProgram?.id, key: r.cacheKey,
        ...(why ? { re: why, lights: prev!.l !== k!.l ? `${prev!.l}->${k!.l}` : undefined } : {}),
        ...(re && re.test(o?.name ?? '') ? { fcode: r.fragmentProgram?.code, vcode: r.vertexProgram?.code } : {}) });
    }
    return r;
  };
}
