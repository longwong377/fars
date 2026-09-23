// Impostor re-bake off the main thread (render.ts TreeKit.setDay, day-to-day ticks): the worker builds the same
// deterministic models and leaf atlas, keeps its own working images, re-bakes the model rows whose foliage group
// changed since its last bake, and returns the mip levels of both impostor images.
import { allModels } from './model';
import { calibrateAndDrawAtlas } from './kitdata';
import { ImpostorBaker, groupStates, type GroupState } from './impostor';
import { groupIndex } from './species';

let baker: ImpostorBaker | null = null; const baked: (GroupState | null)[] = [];
self.onmessage = (e: MessageEvent) => {
  const { id, px, table } = e.data as { id: number; px: number; table: Float32Array };
  const models = allModels();
  if (!baker || baker.px !== px) { baker = new ImpostorBaker(models, calibrateAndDrawAtlas(models), px); baked.length = 0; }
  const st = groupStates(table); let n = 0;
  models.forEach((m, r) => { const s = st[groupIndex(m.species.group)], p = baked[r];
    if (p && p.leaf.every((v, i) => Math.abs(v - s.leaf[i]) < 0.004) && p.blossom.every((v, i) => Math.abs(v - s.blossom[i]) < 0.004)) return;
    baker!.bakeRow(r, s); baked[r] = { leaf: [...s.leaf] as any, blossom: [...s.blossom] as any }; n++; });
  const L = baker.levels(), copy = (ls: typeof L.col) => ls.map(l => ({ data: l.data.slice(), width: l.width, height: l.height })); // the worker keeps its own levels for the next bake
  const col = copy(L.col), nrm = copy(L.nrm);
  (self as any).postMessage({ id, rows: n, col, nrm }, [...col, ...nrm].map(l => l.data.buffer));
};
