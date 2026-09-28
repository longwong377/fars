// The carved-relief atlas in the browser (D-320; arch/relief_atlas.ts says what it is). Loads the two KTX2 array textures
// (public/models/reliefs/{nao,paint}.ktx2: UASTC, transcoded to the GPU's compressed format by three's KTX2Loader with the
// Basis transcoder served from public/models/lib/basis/) and turns atlas mode on for the relief sets built afterwards
// (world.ts awaits it before the reliefs are built). Never throws: a missing or failed atlas, ?reliefatlas=0 or ?models=0
// leave the legacy vertex-painted levels (arch/reliefs.ts), so a relief is never missing.
import * as THREE from 'three/webgpu';
import { ATLAS_INDEX } from '../arch/relief_atlas';
import { setReliefAtlas } from '../arch/reliefs';
import { paintedStoneMaterial, type ReliefAtlasMaps } from './materials';

const STATE = { loaded: false, ms: 0, error: '', formats: {} as Record<string, string>, layers: 0, off: false };
export const reliefAtlasStats = () => ({ ...STATE, defs: Object.keys(ATLAS_INDEX.defs ?? {}).length, bytes: ATLAS_INDEX.bytes });
let MAPS: ReliefAtlasMaps | null = null;
export const reliefAtlasMaps = () => MAPS;

export async function loadReliefAtlas(base = '/', renderer?: THREE.WebGPURenderer): Promise<ReturnType<typeof reliefAtlasStats>> {
  const t0 = performance.now();
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && (q.get('reliefatlas') === '0' || q.get('models') === '0')) { STATE.off = true; return reliefAtlasStats(); }
  if (!((ATLAS_INDEX.version ?? 0) > 0)) { STATE.error = 'no atlas built'; return reliefAtlasStats(); }
  try {
    const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
    const k = new KTX2Loader().setTranscoderPath(base + 'models/lib/basis/');
    // the transcoder's target format from the renderer, else from the WebGPU adapter (as render/models.ts)
    let gpu: any = renderer ?? null;
    if (!gpu) { const ad = await (globalThis as any).navigator?.gpu?.requestAdapter?.().catch(() => null); gpu = { isWebGPURenderer: true, hasFeature: (f: string) => !!ad?.features?.has(f) }; }
    k.detectSupport(gpu);
    const [nao, paint] = await Promise.all([k.loadAsync(base + ATLAS_INDEX.files.nao), k.loadAsync(base + ATLAS_INDEX.files.paint)]);
    for (const [t, cs] of [[nao, THREE.NoColorSpace], [paint, THREE.SRGBColorSpace]] as const) {
      t.colorSpace = cs; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    }
    STATE.formats = { nao: `${(nao as any).isCompressedArrayTexture ? 'array' : '2d'}:${nao.format}`, paint: `${(paint as any).isCompressedArrayTexture ? 'array' : '2d'}:${paint.format}` };
    STATE.layers = (nao.image as any)?.depth ?? 1;
    MAPS = { nao, paint };
    const maps = MAPS; setReliefAtlas(true, () => paintedStoneMaterial(maps));
    STATE.loaded = true;
    k.dispose();
  } catch (e) { STATE.error = String((e as Error).message ?? e); console.warn(`[reliefs] atlas not loaded (${STATE.error}): the vertex-painted levels are drawn`); }
  STATE.ms = Math.round(performance.now() - t0);
  if (typeof window !== 'undefined') (window as any).__reliefAtlas = { stats: reliefAtlasStats };
  return reliefAtlasStats();
}
