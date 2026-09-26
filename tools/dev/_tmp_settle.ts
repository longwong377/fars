import { buildTownPlan } from '../../src/world/settlement/plan';
import { Site } from '../../src/world/settlement/site';
const orig = Site.prototype.settleDoors; const tot: Record<string, number> = {};
const SITE = process.argv[2], PLOT = +(process.argv[3] ?? -1);
Site.prototype.settleDoors = function (this: Site, min?: number) {
  const before = new Set(this.doors); const r = orig.call(this, min);
  for (const m of r.moves) tot[m.kind] = (tot[m.kind] ?? 0) + 1; tot.narrow = (tot.narrow ?? 0) + r.narrow; tot.stepped = (tot.stepped ?? 0) + r.stepped; tot.blocking = (tot.blocking ?? 0) + r.blocking;
  if (this.id === SITE) { const N = this.W * this.H, cells = (e: number) => e < N ? [e, e + this.W] : [e - N, e - N + 1];
    const [i0, j0] = this.plots[PLOT].rect;
    const at = (e: number) => cells(e).map(k => `${k % this.W - i0 + 2},${((k / this.W) | 0) - j0 + 2}`).join('->');
    for (const m of r.moves) if (cells(m.from).some(k => this.cell[k] === PLOT)) console.log(m.kind, at(m.from), '=>', m.to >= 0 ? at(m.to) : '-');
    for (const e of before) if (!this.doors.has(e) && cells(e).some(k => this.cell[k] === PLOT)) console.log('gone', at(e)); }
  return r; };
const t0 = Date.now(); buildTownPlan(); console.log(tot, Date.now() - t0, 'ms');
