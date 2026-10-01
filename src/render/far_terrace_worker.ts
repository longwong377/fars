// D-361: the Terrace's far levels simplified off the main thread (far_terrace.ts posts a mesh's index, positions and weighed
// attributes; the levels' indices come back). The same code runs in line in node and for a test render.
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { farIndices, type FarInput } from './far_terrace_simplify';

const ctx = self as any;
ctx.onmessage = async (e: MessageEvent<{ job: number; I: FarInput }>) => {
  try {
    await MeshoptSimplifier.ready;
    const t0 = performance.now(), r = farIndices(e.data.I), ms = performance.now() - t0;
    ctx.postMessage({ job: e.data.job, idx: r.idx, ms }, r.idx.filter((x): x is Uint32Array => !!x).map(x => x.buffer));
  } catch (err) { ctx.postMessage({ job: e.data.job, idx: [], ms: 0, error: String((err as Error)?.stack ?? err) }); }
};
