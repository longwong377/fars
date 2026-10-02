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
      if (performance.now() > end) {
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
