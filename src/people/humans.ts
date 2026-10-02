// Loads the human system for the renderer (D-090): MakeHuman-derived bodies (humans.json/.bin), the fitted costumes
// (outfits.ts, built at load for every body variant in a Web Worker, so the main thread keeps building the world),
// the textures and the GPU resources (humanGPU.ts).
import * as THREE from 'three/webgpu';
import { decodeHumanAssets, HUMANS_DIR, meshoptSimplify, type HumanAssets } from './humanAssets';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { buildOutfits, type OutfitBuild } from './outfits';
import { HumanGPU } from './humanGPU';
import { loadHumanScans } from './humanScans';
import { cached } from '../world/cache/worldCache';
import { loadPeopleModels, loadHairAtlas, PEOPLE_DIR, type PeopleModels } from './peopleModels';

export interface HumanSystem { A: HumanAssets; O: OutfitBuild; gpu: HumanGPU; ms: { load: number; outfits: number; gpu: number; worker: boolean } }

function outfitsInWorker(meta: any, bin: ArrayBuffer, models: PeopleModels): Promise<OutfitBuild> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./outfit_worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = e => { w.terminate(); if (e.data.error) reject(new Error(e.data.error)); else resolve(e.data as OutfitBuild); };
    w.onerror = e => { w.terminate(); reject(new Error(`outfit worker: ${e.message}`)); };
    w.postMessage({ meta, bin, models }, [bin]);
  });
}

export async function loadHumans(opts: { base?: string; velocity?: boolean; capacity?: number } = {}): Promise<HumanSystem> {
  const base = (opts.base ?? '/') + HUMANS_DIR + '/';
  const t0 = performance.now();
  const get = async (f: string) => { const r = await fetch(base + f); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r; };
  const loader = new THREE.TextureLoader();
  // D-307: the Blender-built hair cards and garment drape (public/models/people; null each when absent: the procedural pieces)
  // (D-322: the scans' array takes the garments' fold layers, so it waits for the people's models)
  const pmP = loadPeopleModels(opts.base ?? '/'), scansP = pmP.then(pm => { const F = pm.drape?.meta.folds; return loadHumanScans(opts.base ?? '/', F ? { url: `${opts.base ?? '/'}${PEOPLE_DIR}/${F.file}`, layers: F.layers, scale: F.scale } : null); });
  const [meta, bin, skin, eye, scans, pm] = await Promise.all([get('humans.json').then(r => r.json()), get('humans.bin').then(r => r.arrayBuffer()), loader.loadAsync(base + 'skin.png'), loader.loadAsync(base + 'eye.png'), scansP, pmP]);
  const hairAtlas = pm.atlasUrl ? await loadHairAtlas(pm.atlasUrl) : null;
  const hairNormal = hairAtlas && pm.normalUrl ? await loadHairAtlas(pm.normalUrl) : null; // D-323 (null: the cards shade flat)
  const models: PeopleModels = { cards: hairAtlas ? pm.cards : null, drape: pm.drape }; // (no atlas, no cards: they would draw untextured)
  for (const t of [skin, eye]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }
  const useWorker = typeof Worker !== 'undefined' && typeof window !== 'undefined';
  const outfits = useWorker ? cached('outfits', 'all', () => outfitsInWorker(meta, bin.slice(0), models)) : null; // D-354: the baked world's copy when unchanged
  const A = decodeHumanAssets(meta, bin);
  const t1 = performance.now();
  let O: OutfitBuild;
  try { O = outfits ? await outfits : (await MeshoptSimplifier.ready, buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), models })); }
  catch (e) { console.warn('outfit worker failed, building on the main thread', e); await MeshoptSimplifier.ready; O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier), models }); }
  const t2 = performance.now();
  const gpu = new HumanGPU(A, O, { skin, eye, scans, hairAtlas, hairNormal, cards: models.cards?.meta ?? null, simCloth: !!models.drape && models.drape.meta.version >= 2, drapeSeeds: models.drape?.meta.seeds ?? 1 }, { capacity: opts.capacity, velocity: opts.velocity });
  return { A, O, gpu, ms: { load: t1 - t0, outfits: t2 - t1, gpu: performance.now() - t2, worker: !!outfits } };
}
