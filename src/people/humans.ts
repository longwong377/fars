// Loads the human system for the renderer (D-025): MakeHuman-derived bodies (humans.json/.bin), the fitted costumes
// (outfits.ts, built at load for every body variant in a Web Worker, so the main thread keeps building the world),
// the textures and the GPU resources (humanGPU.ts).
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, HUMANS_DIR, meshoptSimplify, type HumanAssets } from './humanAssets';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { buildOutfits, type OutfitBuild } from './outfits';
import { HumanGPU } from './humanGPU';

export interface HumanSystem { A: HumanAssets; O: OutfitBuild; gpu: HumanGPU; ms: { load: number; outfits: number; gpu: number; worker: boolean } }

function outfitsInWorker(meta: any, bin: ArrayBuffer): Promise<OutfitBuild> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./outfit_worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = e => { w.terminate(); if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data as OutfitBuild); };
    w.onerror = e => { w.terminate(); reject(new Error(`outfit worker: ${e.message}`)); };
    w.postMessage({ meta, bin }, [bin]);
  });
}

export async function loadHumans(opts: { base?: string; velocity?: boolean; capacity?: number } = {}): Promise<HumanSystem> {
  const base = (opts.base ?? '/') + HUMANS_DIR + '/';
  const t0 = performance.now();
  const get = async (f: string) => { const r = await fetch(base + f); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; };
  const loader = new THREE.TextureLoader();
  const [meta, bin, skin, eye] = await Promise.all([get('humans.json').then(r => r.json()), get('humans.bin').then(r => r.arrayBuffer()), loader.loadAsync(base + 'skin.png'), loader.loadAsync(base + 'eye.png')]);
  for (const t of [skin, eye]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  const useWorker = typeof Worker !== 'undefined' && typeof window !== 'undefined';
  const outfits = useWorker ? outfitsInWorker(meta, bin.slice(0)) : null;
  const A = decodeHumanAssets(meta, bin);
  const t1 = performance.now();
  let O: OutfitBuild;
  try { O = outfits ? await outfits : (await MeshoptSimplifier.ready, buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) })); }
  catch (e) { console.warn('outfit worker failed, building on the main thread', e); await MeshoptSimplifier.ready; O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) }); }
  const t2 = performance.now();
  const gpu = new HumanGPU(A, O, { skin, eye }, { capacity: opts.capacity, velocity: opts.velocity });
  return { A, O, gpu, ms: { load: t1 - t0, outfits: t2 - t1, gpu: performance.now() - t2, worker: !!outfits } };
}
