// s15/ship (D-368, UD-31): progressive shader compile, so the player's loop never waits on a shader.
//  1. Every render pipeline is created with createRenderPipelineAsync (the browser compiles them on its own threads, several at
//     once) and a draw whose pipeline is not ready is skipped this frame (three's Pipelines.isReady): the first frame is drawn
//     at once and the world comes in as its shaders finish, and no submit waits on a compile (the T4 watchdog, D-353).
//  2. The materials' shader BUILDS (three's node builder: JS on the main thread, the bulk of a first frame's CPU) are spread
//     over frames: once a frame's draw has spent `budgetMs`, a draw whose render object has never been built waits for the next
//     frame. Only inside drawStart()/drawEnd() (the frame's own draw): one-off renders elsewhere (bakes, readbacks) are never
//     deferred, so nothing is left unbuilt.
// Relies on three r186 internals (Renderer._renderObjectDirect / _handleObjectFunction / _objects, Pipelines.getForRender,
// RenderObject._nodeBuilderState): tools/deploy/progressive_probe.* checks them on the GPU.
import type * as THREE from 'three/webgpu';

export interface Progressive { drawStart(): void; drawEnd(): void; stats(): { live: number; done: number; deferred: number } }

export function installProgressiveCompile(renderer: THREE.WebGPURenderer, budgetMs = 40): Progressive {
  const R: any = renderer, pl: any = R._pipelines, orig = pl.getForRender;
  let pend: Promise<void>[] = [], live = 0, done = 0, deferred = 0, end = Infinity;
  pl.getForRender = function (ro: any, pr: any) {
    if (pr) return orig.call(this, ro, pr); // (a caller's own compile list: compileAsync, the warm-up)
    const n = pend.length, r = orig.call(this, ro, pend);
    for (let i = n; i < pend.length; i++) { live++; pend[i].then(() => { live--; done++; }, () => { live--; }); }
    if (pend.length > 256) pend = [];
    return r;
  };
  if (budgetMs > 0) {
    const direct = R._renderObjectDirect;
    R._renderObjectDirect = function (object: any, material: any, scene: any, camera: any, lightsNode: any, group: any, clip: any, passId: any) {
      // D-680 (s18, the live page's black frames): the post pipeline's full-screen quads (the composite, the meter, every pass)
      // are drawn last, after the world has spent the frame's build budget; deferred, they were deferred EVERY frame while the
      // world streamed in, and the player saw black (and the meter read an unwritten target). A quad is never deferred.
      if (performance.now() > end && !object.isQuadMesh) {
        const ro = this._objects.get(object, material, scene, camera, lightsNode, this._currentRenderContext, clip, passId);
        if (ro._nodeBuilderState === null) { deferred++; return; }
      }
      return direct.call(this, object, material, scene, camera, lightsNode, group, clip, passId);
    };
    R._handleObjectFunction = R._renderObjectDirect;
  }
  return {
    drawStart: () => { if (budgetMs > 0) end = performance.now() + budgetMs; },
    drawEnd: () => { end = Infinity; },
    /** pipelines compiling now, compiled so far, draws deferred since the last call */
    stats: () => { const d = deferred; deferred = 0; return { live, done, deferred: d }; },
  };
}

/** D-740 (s18, the T4's black screen): one bad binding must cost one object, never the frame. Three's per-object draw
 *  (updateBindings -> GPUQueue.writeBuffer / writeTexture) throws on a destroyed or missing buffer, or a texture without
 *  data, and the throw aborts the whole render pass and every frame after it (Vagon: 0 draw calls; with the two bad calls
 *  skipped the frame drew 167 -> 259). Here: a writeBuffer to something that is not a GPU buffer, and a writeTexture that
 *  throws, are skipped; an object whose draw throws is skipped for that frame. Each is logged once, with the object's name
 *  and its parents (window.__renderFaults). Call after installProgressiveCompile. */
export function installRenderSafetyNet(renderer: THREE.WebGPURenderer) {
  const R: any = renderer; if (R.__safetyNet) return; R.__safetyNet = true;
  const faults: Record<string, { n: number; what: string; first: string }> = ((globalThis as any).__renderFaults = {});
  let cur: any = null;
  const pathOf = (o: any) => { const p: string[] = []; for (let x = o; x && p.length < 5; x = x.parent) p.push(x.name || x.type); return p.join(' < '); };
  const note = (what: string, e?: unknown) => { const k = `${what}|${cur ? pathOf(cur) : '?'}`, f = faults[k];
    if (f) { f.n++; return; }
    faults[k] = { n: 1, what, first: String((e as any)?.message ?? e ?? '').slice(0, 200) };
    console.warn(`[render] skipped: ${what} on "${cur ? pathOf(cur) : 'unknown object'}" (${faults[k].first}); logged once`); };
  const Q: any = (globalThis as any).GPUQueue?.prototype, B: any = (globalThis as any).GPUBuffer;
  if (Q && !Q.__parsaSafe) { Q.__parsaSafe = true; const wb = Q.writeBuffer, wt = Q.writeTexture;
    Q.writeBuffer = function (this: any, buf: any, ...a: any[]) { if (B && !(buf instanceof B)) { note('writeBuffer to a missing buffer'); return; } try { return wb.call(this, buf, ...a); } catch (e) { note('writeBuffer', e); } };
    Q.writeTexture = function (this: any, ...a: any[]) { try { return wt.apply(this, a); } catch (e) { note('writeTexture', e); } }; }
  // (a copy between textures that throws is skipped: on WebGL2 three's TRAA copies the scene's depth texture into its history
  // and the WebGL backend's depth copy looks up a render target the depth texture does not record ("Invalid value used as
  // weak map key"): the throw aborted the post pipeline's quad every frame and the canvas stayed black on the WebGL path; the
  // history keeps last frame's depth instead)
  const copy = R.copyTextureToTexture?.bind(R);
  if (copy) R.copyTextureToTexture = (...a: any[]) => { try { return copy(...a); } catch (e) { note('copyTextureToTexture', e); } };
  const direct = R._renderObjectDirect;
  R._renderObjectDirect = function (object: any, ...rest: any[]) { const prev = cur; cur = object;
    try { return direct.call(this, object, ...rest); } catch (e) { note('draw', e); } finally { cur = prev; } };
  R._handleObjectFunction = R._renderObjectDirect;
}

/** D-740 (s18, the T4's black screen: "[Buffer bindingBuffer…] used in submit while destroyed" in the shadow pass): a
 *  dispose() runs at once, while the frame being built may already have bound what it frees (the shadow passes are encoded
 *  before the scene's updates finish; a material's dispose frees every binding of every object using it), and WebGPU then
 *  rejects the whole submit: nothing of the frame is drawn. Every dispose of a geometry, material, texture or render target
 *  is deferred here: it runs `frames` frames later (tick() once a frame, main.ts), or after 2 s when no frame is being drawn
 *  (the world's build). What is disposed and then used again is simply re-uploaded by three. window.__deferredDisposals counts. */
export function deferDisposals(T: { Material: any; BufferGeometry: any; Texture: any; RenderTarget?: any }, frames = 3) {
  const Q: { f: number; t: number; run: () => void }[] = [], st = ((globalThis as any).__deferredDisposals = { queued: 0, run: 0, max: 0 }); let frame = 0, lastTick = 0;
  const drain = (force: boolean) => { const now = performance.now(); let k = 0;
    while (k < Q.length && (force || frame - Q[k].f >= frames || (now - lastTick > 2000 && now - Q[k].t > 2000))) k++;
    const due = Q.splice(0, k); for (const d of due) { try { d.run(); st.run++; } catch (e) { console.warn('[render] deferred dispose failed', e); } } };
  for (const C of [T.Material, T.BufferGeometry, T.Texture, T.RenderTarget]) { const proto = C?.prototype; if (!proto || proto.__parsaDeferred) continue; proto.__parsaDeferred = true;
    const dispose = proto.dispose;
    proto.dispose = function (this: any, ...a: any[]) { if (this.__disposeQueued) return; this.__disposeQueued = true;
      Q.push({ f: frame, t: performance.now(), run: () => { this.__disposeQueued = false; dispose.apply(this, a); } }); st.queued++; st.max = Math.max(st.max, Q.length); }; }
  setInterval(() => drain(false), 1000);
  return { /** once a frame, before it is built */ tick: () => { frame++; lastTick = performance.now(); drain(false); }, flush: () => drain(true) };
}
