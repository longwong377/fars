import { Site } from '../../src/world/settlement/site';
import * as acc from '../../src/world/settlement/access';
const T: Record<string, number> = {};
for (const m of ['connectPlots', 'settleDoors'] as const) { const o = (Site.prototype as any)[m]; (Site.prototype as any)[m] = function (...a: any[]) { const t = performance.now(); const r = o.apply(this, a); T[m] = (T[m] ?? 0) + performance.now() - t; return r; }; }
const oa = acc.ensureAccess; void oa;
const t0 = performance.now(); const { buildTownPlan } = await import('../../src/world/settlement/plan'); buildTownPlan(); console.log('total', (performance.now() - t0).toFixed(0), T);
