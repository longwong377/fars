// Web Worker for carved-relief generation (D-019): rasterises a figure's heightfield and extracts one LOD mesh off the main
// thread. Pure computation (no three.js); the same code runs synchronously in node for the tests.
import { figureDef } from './relief_figures';
import { rasterize, rtinErrors, extractLod } from './relief_field';

export interface ReliefJob { id: number; kind: string; seed: number; n: number; err: number; grad: number; pre?: boolean;
  /** D-226: return the rasterised field itself (the relief shadow atlas stamps it), not a LOD mesh */ field?: boolean }
const ctx = self as any;
ctx.onmessage = (e: MessageEvent<ReliefJob>) => {
  const j = e.data;
  try {
    const f = rasterize(figureDef(j.kind, j.seed), j.n, !!j.pre);
    if (j.field) { ctx.postMessage({ id: j.id, field: { n: f.n, x0: f.x0, y0: f.y0, cell: f.cell, h: f.h } }, [f.h.buffer]); return; }
    const m = extractLod(f, rtinErrors(f), j.err, j.grad);
    ctx.postMessage({ id: j.id, mesh: m }, [m.pos.buffer, m.grad.buffer, m.col.buffer, m.paint.buffer, m.gilt.buffer, m.ao.buffer, m.index.buffer]);
  } catch (err) { ctx.postMessage({ id: j.id, error: String(err) }); }
};
