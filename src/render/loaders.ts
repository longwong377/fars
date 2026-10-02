// D-392 (s15/load): one KTX2 transcoder and one Draco decoder for the whole page. Every asset module made its own (ten
// KTX2Loaders and seven DRACOLoaders, four workers each, each worker fetching and compiling its own wasm): on a 4-thread box
// the decodes queued behind ~70 workers' start-up. Now one pool per decoder, sized to the cores less the main thread. The
// transcoder's target format: the renderer's when the first caller has one, else the WebGPU adapter's features (as before,
// render/models.ts D-306: the world loads before it has a renderer). Never dispose them (shared).
import { BASE } from '../core/base';

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
    return k;
  })());
}
/** the page's DRACOLoader (three's) */
export function sharedDraco(base = BASE): Promise<any> {
  return (dracoP ??= import('three/addons/loaders/DRACOLoader.js').then(({ DRACOLoader }) => new DRACOLoader().setDecoderPath(base + 'models/lib/draco/').setWorkerLimit(pool())));
}
