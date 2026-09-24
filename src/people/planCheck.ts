// "Plans well formed" (§13.11 soak, D-021): checks of a person's day plan that the per-person variety gate cannot see.
//  - no_sleep: fewer than 4 h asleep (or lying ill) in the 24 h of a resident's day
//  - reason:   the activity contradicts its own reason ("play" — "asleep"; "rest" — "spinning")
//  - meals:    an adult awake 10 h or more with fewer than two meals, more than 4.5 h from waking to the first food, or
//              more than 8 h between meals while awake
//  - teleport: yesterday ended at one place and today starts at another
//  - apart:    a child (or infant) is "with" someone who is somewhere else (sampled days)
//  - alone:    a child under ten is at night where no adult of its household is (sampled days)
//  - minding:  a child "minding" a little one (or carrying one, or out to the lane or home with one) has no little one of its
//              house with it: none of the house's children of four or under is at the same place with `with` = the minder
//              (sampled days; S2 of shadow review r5)
import type { ActivityId } from './activities';
import type { Population, Seg } from './population';
import { segAt } from './population';

/** reasons that name what the person does: the reason's leading words fix the activity */
const RULES: [RegExp, ActivityId[]][] = [
  [/^(asleep|sleeping|a midday sleep|a morning sleep|a short sleep|an afternoon sleep)/, ['sleep']],
  [/^(lying ill|fallen ill)/, ['lie_ill']],
  [/^(breakfast|the (midday|evening) meal|the last breakfast|a meal|midday meal|evening meal|bread and water|nursed|eating|a birthday meal|his birthday meal|at a kinsman’s birthday meal|a little food|food after|a midday meal|making camp and eating)/, ['eat']],
  [/^grinding/, ['grind']], [/^spinning/, ['spin']], [/^weaving/, ['weave']], [/^playing/, ['play']],
  [/^(fetching water|drawing water|evening water)/, ['draw_water']],
  [/^carrying/, ['carry_sack', 'carry_jar', 'carry_jar_head', 'carry_bread', 'haul']],
  [/^knucklebones/, ['gamble']], [/^(visiting|talking|a dispute)/, ['talk']],
  [/^(resting|nursing|stopping to nurse)/, ['rest', 'lie_ill']],
  [/^(on watch|standing in at the post)/, ['stand_guard']], [/^(in the queue|waiting for the ration)/, ['queue']],
  [/^kneading/, ['knead']], [/^baking/, ['bake']],
];
const reasonCache = new Map<string, boolean>();
export function reasonOk(act: ActivityId, why: string) {
  const k = act + '|' + why; let v = reasonCache.get(k); if (v !== undefined) return v;
  v = true; for (const [re, acts] of RULES) if (re.test(why)) { v = acts.includes(act); break; }
  if (reasonCache.size < 200000) reasonCache.set(k, v); return v;
}
export type PlanIssue = 'no_sleep' | 'reason' | 'meals' | 'teleport' | 'apart' | 'alone' | 'minding';
/** a reason that says the person has a little one with them (the minder's words: Population.mindDay) */
export const MINDING = /^(minding (the little|her little|his little)|carrying (the little|her little|his little)|(out to the lane|home) with (the little|her little|his little))/;
/** the issues of one person's plan on one day; `prevLast` is where yesterday's plan ended */
export function checkPlan(P: Population, pid: number, d: number, segs: Seg[], prevLast: string | null): { kind: PlanIssue; note: string }[] {
  const p = P.persons[pid], out: { kind: PlanIssue; note: string }[] = []; if (segs[0].act === 'offmap' && segs.length === 1) return out;
  let sleep = 0, off = 0, ill = 0; for (const s of segs) { const h = s.t1 - s.t0; if (s.act === 'sleep') sleep += h; else if (s.act === 'lie_ill') { sleep += h; ill += h; } else if (s.act === 'offmap') off += h; }
  if (sleep < 4 && off < 6) out.push({ kind: 'no_sleep', note: `${sleep.toFixed(1)} h asleep` });
  for (const s of segs) if (s.where !== 'road' && !reasonOk(s.act, s.why)) { out.push({ kind: 'reason', note: `${s.act} — ${s.why}` }); break; }
  // meals: adults awake for a working day
  if (P.ageOn(pid, d) >= 14 && ill < 6 && off === 0) {
    const awake = segs.filter(s => s.act !== 'sleep' && s.act !== 'lie_ill' && !/ in the night/.test(s.why)); const wake = awake[0]?.t0 ?? 0, bed = awake[awake.length - 1]?.t1 ?? 0;
    const eats = segs.filter(s => s.act === 'eat');
    if (bed - wake >= 10) {
      if (eats.length < 2) out.push({ kind: 'meals', note: `${eats.length} meal(s) in ${(bed - wake).toFixed(1)} h awake` });
      else { let gap = 0; for (let i = 1; i < eats.length; i++) gap = Math.max(gap, eats[i].t0 - eats[i - 1].t1);
        const first = wake >= 3 ? eats[0].t0 - wake : 0;
        if (gap > 8) out.push({ kind: 'meals', note: `${gap.toFixed(1)} h between meals` }); else if (first > 4.5) out.push({ kind: 'meals', note: `first food ${first.toFixed(1)} h after waking` }); }
    }
  }
  const first = segs[0].place; if (d !== p.marry && prevLast && prevLast !== '-' && first !== '-' && segs[0].where !== 'road' && !prevLast.startsWith('road:') && prevLast !== first) out.push({ kind: 'teleport', note: `${prevLast} → ${first}` });
  return out;
}
/** on one day, for everyone: a person "with" another is where that one is; a child under ten is not alone at night; a child
 *  minding a little one has one with it */
export function checkDay(P: Population, d: number, planOf: (pid: number) => Seg[]): { kind: PlanIssue; pid: number; note: string }[] {
  const out: { kind: PlanIssue; pid: number; note: string }[] = [];
  for (let pid = 0; pid < P.persons.length; pid++) {
    const p = P.persons[pid]; if (!P.present(pid, d) || p.zone === 'transient') continue; const segs = planOf(pid);
    for (const s of segs) { if (s.with === undefined) continue; const mid = (s.t0 + s.t1) / 2; const o = segAt(planOf(s.with), mid);
      if (o.place !== s.place && !(o.where === 'road' && s.where === 'road')) { out.push({ kind: 'apart', pid, note: `${s.t0.toFixed(2)} ${s.place} (${s.act}) but ${s.with} at ${o.place} (${o.act})` }); break; } }
    for (const s of segs) { if (!MINDING.test(s.why)) continue; const kids = P.membersOn(P.home(pid, d), d).filter(x => x !== pid && P.ageOn(x, d) <= 4);
      const e = Math.min(0.01, (s.t1 - s.t0) / 4), bad = [s.t0 + e, (s.t0 + s.t1) / 2, s.t1 - e].find(h => !kids.some(x => { const o = segAt(planOf(x), h); return o.with === pid && (o.place === s.place || (o.where === 'road' && s.where === 'road')); }));
      if (bad !== undefined) { out.push({ kind: 'minding', pid, note: `${bad.toFixed(2)} ${s.place} "${s.why}" with no little one of the house there with it` }); break; } }
    if (P.ageOn(pid, d) < 10 && p.agent < 0) for (const h of [1.5, 23.5]) { const s = segAt(segs, h); if (s.where === 'road' || s.place === '-') continue;
      const ok = (s.with !== undefined && segAt(planOf(s.with), h).place === s.place) || P.membersOn(P.home(pid, d), d).some(x => x !== pid && P.persons[x].age >= 14 && segAt(planOf(x), h).place === s.place);
      if (!ok) { out.push({ kind: 'alone', pid, note: `${h}: at ${s.place} with no adult of the household` }); break; } }
  }
  return out;
}
