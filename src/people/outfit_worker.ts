// Web Worker: fits every costume to every body variant (outfits.ts) off the main thread; the same code runs
// synchronously in node for the tests. Input: the humans.json metadata and a copy of humans.bin.
import { decodeHumanAssets } from './humanAssets';
import { buildOutfits } from './outfits';
import type { HumanAssetsMeta } from './humanFormat';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { meshoptSimplify } from './humanAssets';

const ctx = self as any;
ctx.onmessage = async (e: MessageEvent<{ meta: HumanAssetsMeta; bin: ArrayBuffer }>) => {
  try {
    const A = decodeHumanAssets(e.data.meta, e.data.bin);
    await MeshoptSimplifier.ready;
    const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
    const transfer: ArrayBuffer[] = [O.source.buffer as ArrayBuffer];
    for (const list of Object.values(O.costumes)) for (const C of list) for (const k of ['tid', 'skinIndex', 'skinWeight', 'uv', 'hmat', 'hext', 'refPos', 'refNrm', 'index'] as const) transfer.push((C as any)[k].buffer);
    ctx.postMessage({ NV: O.NV, pieceBase: O.pieceBase, source: O.source, costumes: O.costumes, ms: O.ms }, transfer);
  } catch (err) { ctx.postMessage({ error: String((err as Error)?.stack ?? err) }); }
};
