// D-363 (B176): the prop each impostor frame's animation holds in the activities (the most common), for the Cycles bake
import { ACTIVITIES } from '../../src/people/activities';
import { FRAMES } from '../../src/people/impostors';
export function framePropOf(anim: string): string | null {
  const n = new Map<string, number>();
  const visit = (o: any) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(visit); return; }
    if (o.anim === anim && typeof o.prop === 'string') n.set(o.prop, (n.get(o.prop) ?? 0) + 1);
    for (const k of Object.keys(o)) if (k !== 'animals' && k !== 'work') { const v = o[k]; if (v && typeof v === 'object') visit(v); } };
  for (const a of Object.values(ACTIVITIES)) visit(a);
  // a variant without its own anim takes its activity's
  for (const a of Object.values(ACTIVITIES) as any[]) if (a.anim === anim) for (const v of (a.perf ?? a.variants ?? [])) if (!v.anim && typeof v.prop === 'string') n.set(v.prop, (n.get(v.prop) ?? 0) + 1);
  let best: string | null = null, bn = 0; for (const [k, c] of n) if (c > bn) { best = k; bn = c; } return best;
}
if (process.argv[1]?.endsWith('imp_props.ts')) for (const f of FRAMES) console.log(f.id, f.anim, f.prop ?? '', '->', framePropOf(f.anim));
