// Reading consequence chains off the economy's causal graph (T-F9). A chain ends at a leaf event (nothing it caused yet);
// it is the longest causal path into that leaf; it counts when it has >= 3 events and its events span >= 2 actors
// (households or systems). Deduplicated by shape: the same sequence of event kinds ending at the same actor counts once
// (a household that is robbed three times the same way is one chain, not three).
import type { EconEvent } from './world';
import type { Population } from '../population';
import type { HHSeed, HHKind } from './world';

export interface Chain { leaf: number; path: number[]; shape: string; actors: string[] }

export function chains(events: EconEvent[]): Chain[] {
  events = events.filter(e => e?.actor); // (a loaded economy's older events are gone or kept as day and kind only: D-347)
  const byId = new Map(events.map(e => [e.id, e])); // (D-359: by id, not by position in the filtered list: simtalk's finding)
  const hasChild = new Set<number>(); for (const e of events) for (const c of e.causes) hasChild.add(c);
  const best = new Map<number, number[]>(); // longest path ending at each event (events are in causal order: causes precede)
  for (const e of events) {
    let p: number[] = [];
    for (const c of e.causes) { const q = best.get(c)!; if (q && q.length > p.length) p = q; }
    best.set(e.id, [...p, e.id]);
  }
  const out: Chain[] = [], seen = new Set<string>();
  for (const e of events) {
    if (hasChild.has(e.id)) continue;
    const path = best.get(e.id)!; if (path.length < 3) continue;
    const actors = [...new Set(path.flatMap(i => [byId.get(i)!.actor, ...(byId.get(i)!.other ? [byId.get(i)!.other!] : [])]))];
    if (actors.length < 2) continue;
    const shape = path.map(i => byId.get(i)!.kind).join('>');
    const key = `${shape}@${e.actor}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ leaf: e.id, path, shape, actors });
  }
  return out;
}

/** the households of a Population, as the economy sees them */
export function householdsOf(pop: Population): HHSeed[] {
  return pop.households.filter(H => H.zone !== 'transient' && H.members.length).map(H => {
    const ps = H.members.map(m => pop.persons[m]);
    const jobs = ps.map(p => p.job);
    const kind: HHKind = jobs.some(j => j === 'official' || j === 'steward') ? 'rich' : jobs.some(j => j === 'farmer' || j === 'gardener') ? 'farmer'
      : jobs.includes('craftsman') || jobs.includes('weaver') ? 'craft' : jobs.some(j => j === 'shepherd' || j === 'herder') ? 'herder' : 'ration';
    return { id: `h:${H.id}`, kind, eaters: ps.length, workers: ps.filter(p => p.age >= 14 && p.age < 60 && p.job !== 'child').length, q: H.q, kin: H.kin.map(x => `h:${x}`) };
  });
}
