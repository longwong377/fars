// D-392 (s15/load): one KTX2 transcoder and one Draco decoder for the whole page. Every asset module made its own (ten
// KTX2Loaders and seven DRACOLoaders, four workers each, each worker fetching and compiling its own wasm): on a 4-thread box
// the decodes queued behind ~70 workers' start-up. Now one pool per decoder, sized to the cores less the main thread. The
// transcoder's target format: the renderer's when the first caller has one, else the WebGPU adapter's features (as before,
// render/models.ts D-306: the world loads before it has a renderer). Never dispose them (shared).
import { BASE } from '../core/base';
import { lowFirstKTX2 } from './lowfirst';

// D-463: dispose() on a shared loader is a no-op. scans.ts still disposed the KTX2 loader after the scans: three's dispose
// terminates the pool and revokes its worker's blob URL, and every later load in the page waited forever (the boot hung).
const keep = <T extends { dispose(): any }>(l: T): T => { l.dispose = () => l; return l; };
// D-580 (s17): s16 measured the shared pools +0.19 GB at ready: one pool's workers live on, each grown to the largest texture
// or mesh it decoded, where every module's own pool was disposed after its load. So the workers (not the loaders) end once
// the pool has been idle IDLE_MS: no transcode running or queued, no Draco task pending. A later load starts them again
// (three makes a pool's workers on demand; the blob URL a worker is made from is kept: only dispose() revokes it).
const IDLE_MS = 4000;
function reapWhenIdle(busy: () => boolean, end: () => void): () => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  const check = () => { t = null; if (busy()) arm(); else end(); };
  const arm = () => { if (t) clearTimeout(t); t = setTimeout(check, IDLE_MS); };
  return arm;
}
const wrap = (o: any, k: string, after: () => void) => { const f = o[k].bind(o); o[k] = (...a: any[]) => { after(); const r = f(...a); Promise.resolve(r).then(after, after); return r; }; };
/** worker counts and reaps (the load tools read it) */
export const loaderStats = { ktx2Reaped: 0, dracoReaped: 0 };
const pool = () => Math.max(1, Math.min(8, (((globalThis as any).navigator?.hardwareConcurrency as number | undefined) ?? 4) - 1));
let adP: Promise<any> | null = null, k2P: Promise<any> | null = null, dracoP: Promise<any> | null = null;
/** the WebGPU adapter (null without one), asked once */
export const gpuAdapter = (): Promise<any> => (adP ??= Promise.resolve().then(() => (globalThis as any).navigator?.gpu?.requestAdapter?.() ?? null).catch(() => null));
/** the page's KTX2Loader (three's), its transcoder target set */
export function sharedKTX2(base = BASE, renderer?: any): Promise<any> {
  return (k2P ??= (async () => {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    const k = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/').setWorkerLimit(pool());
    if (renderer) k.detectSupport(renderer);
    else { const ad = await gpuAdapter(); k.detectSupport({ isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) } as any); }
    // (the pool is idle when no worker is busy and nothing is queued)
    const wp = (k as any).workerPool, arm = reapWhenIdle(() => wp.workerStatus !== 0 || wp.queue.length > 0, () => { if (wp.workers.length) { wp.dispose(); loaderStats.ktx2Reaped++; } });
    wrap(wp, 'postMessage', arm);
    return keep(lowFirstKTX2(k, base)); // (D-740: the scans' ETC1S twins first, their UASTC after the world is up)
  })());
}
/** the page's DRACOLoader (three's) */
export function sharedDraco(base = BASE): Promise<any> {
  return (dracoP ??= import('three/addons/loaders/DRACOLoader.js').then(({ DRACOLoader }) => {
    const d: any = new DRACOLoader().setDecoderPath(base + 'models/lib/draco/').setWorkerLimit(pool());
    // (idle: no worker has a task; its workers terminated, the pool emptied, so _getWorker makes new ones)
    const arm = reapWhenIdle(() => d.workerPool.some((w: any) => w._taskLoad > 0 || Object.keys(w._callbacks).length > 0),
      () => { if (d.workerPool.length) { for (const w of d.workerPool) w.terminate(); d.workerPool.length = 0; loaderStats.dracoReaped++; } });
    wrap(d, 'decodeGeometry', arm); return keep(d);
  }));
}
