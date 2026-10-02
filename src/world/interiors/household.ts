// s17 C7 (D-610): who lives in a room, for the furnishing (plan.ts). The population's households (people/population.ts:
// members, ages, jobs, the plot they live on; the plain's households by the compound PopGeo gives them) when the world has
// handed them over (setInteriorPeople, world.ts after the people are made); else the plot alone (its kind, craft, size
// and the house's life: houseplan.ts). A room's use comes from its house: the street door's room is the vestibule, the
// largest of the rest the living room, a workshop's rooms its workrooms and stores, a house of three rooms or more keeps
// a kitchen and a store, the rest are slept in (C).
import type { Population } from '../../people/population';
import { hashString } from '../../core/rng';
import type { Profile, Use } from './plan';

const h01 = (s: string) => hashString(s) / 4294967296;
interface HH { members: number; children: number; infants: number; women: number; elders: number; jobs: string[]; persian: boolean }
let POP: Population | null = null;
let VILLAGE: ((hh: number) => string | null) | null = null;
let BY_PLOT: Map<string, HH> | null = null;
/** the world's people (world.ts, once the population is made): the town's households by their plot, the plain's by their
 *  compound (`villagePlot`: a household → its compound's plot id, `<village>-c<i>`) */
export function setInteriorPeople(pop: Population | null, villagePlot: ((hh: number) => string | null) | null = null) { POP = pop; VILLAGE = villagePlot; BY_PLOT = null; peopleVersion++; }
/** bumped when the people are handed over (the ring re-plans its rooms) */
export let peopleVersion = 0;
function index(): Map<string, HH> {
  if (BY_PLOT) return BY_PLOT; const m = new Map<string, HH>(); BY_PLOT = m; if (!POP) return m;
  const P = POP;
  P.households.forEach((H, hi) => {
    const ids: string[] = H.zone === 'town' ? (H.plots ?? (H.plot ? [H.plot] : [])) : H.zone === 'plain' && VILLAGE ? [VILLAGE(hi)].filter((x): x is string => !!x) : [];
    if (!ids.length) return;
    const ms = H.members.map(x => P.persons[x]);
    const add = (id: string) => { const o = m.get(id) ?? { members: 0, children: 0, infants: 0, women: 0, elders: 0, jobs: [], persian: false };
      o.members += ms.length; for (const q of ms) { if (q.age < 14) o.children++; if (q.age <= 2) o.infants++; if (q.sex === 'f' && q.age >= 14) o.women++; if (q.age >= 55 || q.job === 'elder') o.elders++;
        const j = q.sub ? `${q.job}` : q.job; if (!o.jobs.includes(j)) o.jobs.push(j); if (q.sub === 'smith' && !o.jobs.includes('smith')) o.jobs.push('smith'); }
      o.persian ||= H.persian; m.set(id, o); };
    add(ids[0]); // (an estate's other plots: its household lives in the first, D-081)
  });
  return m;
}
/** the people of a plot from the population (null when the world has not handed them over, or nobody lives there) */
export const plotPeople = (id: string) => index().get(id) ?? null;
/** has the population been handed over? */
export const havePeople = () => !!POP;

/** a house's household for the furnishing: the population's when known, else a probable one from the plot (C) */
export function houseProfile(id: string, kind: string, craft: string | null, standing: number, capacity: number, animal: string | null, season: Profile['season'], place: Profile['place']): Profile {
  const hh = plotPeople(id);
  if (hh) return { standing, members: hh.members, children: hh.children, infants: hh.infants, women: hh.women, elders: hh.elders, craft, jobs: hh.jobs, animal, persian: hh.persian, season, from: 'population', place };
  // the plot alone: a household of the plot's size (the population fills the largest houses with the largest households,
  // D-081), its children and women by the region's household templates (population.json: ~45 % children; C)
  const r = (k: string) => h01(`${id}:hh:${k}`);
  const members = kind === 'workshop' ? 2 + Math.round(r('m') * 2) : Math.max(2, Math.round((place === 'village' ? 4 + r('m') * 5 : Math.max(3, Math.min(14, capacity || 5) * (0.7 + 0.5 * r('m'))))));
  const children = Math.round(members * (0.3 + 0.25 * r('c'))), infants = r('i') < 0.35 ? 1 : 0;
  const jobs = kind === 'workshop' ? ['craftsman'] : place === 'village' ? ['farmer', 'homemaker', ...(r('h') < 0.35 ? ['herder'] : [])] : [['porter', 'builder', 'farmer', 'treasury', 'craftsman', 'gardener', 'guard'][Math.floor(r('j') * 7)], 'homemaker'];
  return { standing, members, children, infants, women: Math.max(1, Math.round((members - children) / 2)), elders: r('e') < 0.4 ? 1 : 0, craft, jobs, animal, persian: false, season, from: 'plot', place };
}

/** the uses of a house's rooms (C): `rooms` its whole rooms (id, area, whether the street door opens into it) */
export function roomUses(id: string, kind: string, rooms: { room: number; area: number; street: boolean }[]): Map<number, Use> {
  const out = new Map<number, Use>(); const rest = rooms.filter(r => !r.street).sort((a, b) => b.area - a.area || a.room - b.room);
  for (const r of rooms) if (r.street) out.set(r.room, 'vestibule');
  if (!rest.length) { for (const r of rooms) if (r.street && rooms.length === 1) out.set(r.room, kind === 'workshop' ? 'workroom' : 'living'); return out; } // (a one-room house lives in it)
  const h = (k: string) => h01(`${id}:uses:${k}`);
  if (kind === 'workshop') { rest.forEach((r, i) => out.set(r.room, i === 0 || (i === 1 && h('w2') < 0.5) ? 'workroom' : 'store')); return out; }
  out.set(rest[0].room, 'living'); const others = rest.slice(1);
  if (others.length >= 2) { // a kitchen and a store, the smallest rooms first (C)
    const bySize = [...others].sort((a, b) => a.area - b.area || a.room - b.room);
    out.set(bySize[0].room, h('k') < 0.5 ? 'store' : 'kitchen'); out.set(bySize[1].room, out.get(bySize[0].room) === 'store' ? 'kitchen' : 'store');
    for (const r of bySize.slice(2)) out.set(r.room, h('s' + r.room) < 0.3 ? 'store' : 'sleeping');
  } else if (others.length === 1) out.set(others[0].room, h('one') < 0.5 ? 'store' : 'sleeping');
  return out;
}
