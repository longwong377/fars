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
//  and the year-wide classes of fault (the invariants of D-191; shadow review r7: a roof plastered in a storm, a gang idle
//  for hours before the ration issue; each class swept over every person-day, not found one instance at a time):
//  - weather:  (a) out of doors through rain or a storm (more than WEATHER_TOL_H of it), or at leisure out of doors in the
//              dust, unless the rule allows it (WET_OK: the road, the watch, the flock, shelter)
//  - light:    (b) out-of-doors work that needs light (LIGHT_ACTS; play by the water) in the dark, before civil dawn or
//              after dusk (sunrise - 0.45 h, sunset + 0.45 h), with no lamp, fire or moon in its reason
//  - wait:     (c) standing idle, waiting or in a queue, for more than WAIT_CAP_H at a stretch, unless the wait is a
//              labelled part of the work (WAIT_OK)
//  - label:    (d) a reason that asserts a condition that does not hold (LABELS: "before the rains" after the first rain,
//              "the heat" on a cool day, "the rain" or "the storm" with none near, a meal named for another hour ...;
//              "with the household" with no one of it there, and "kept for the late-comer" when the household had not
//              eaten before: the household's plans that day)
//  - feed:     (e) a baby under one waits longer between feeds than the planner's own rule allows (infant_care: by day
//              day_feed_every_h's longest + 0.4 h, by night night_gap_max_h for its age)
//  - dress:    (f) out of doors in the dust (not eating) or in the cold (below outfits.COLD_C for more than a quarter of an
//              hour) without the dress for it, asleep and carried children too; or the dress worn for more than half an
//              hour out of the weather it is for
import type { ActivityId } from './activities';
import type { Population, Seg } from './population';
import { segAt, OPEN_PLACE, OPEN_WHY, outdoors, wetHours, monthsOld, nightGapMax, heatStretch, WET_OK_FLOCK, backFromOk, NIGHT_FEED } from './population';
export { OPEN_PLACE, OPEN_WHY, outdoors, wetHours, monthsOld, nightGapMax };
import type { DayWx, DayCtx } from './calendar';
import { COLD_C } from './outfits';
import livesData from '../data/lives.json';
const IC = (livesData as any).infant_care;

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
export type PlanIssue = 'no_sleep' | 'reason' | 'meals' | 'teleport' | 'apart' | 'alone' | 'minding' | 'weather' | 'light' | 'wait' | 'label' | 'feed' | 'dress';
/** a reason that says the person has a little one with them (the minder's words: Population.mindDay) */
export const MINDING = /^(minding (the little|her little|his little)|carrying (the little|her little|his little)|(out to the lane|home) with (the little|her little|his little))/;
/** the issues of one person's plan on one day; `prevLast` is where yesterday's plan ended */
export function checkPlan(P: Population, pid: number, d: number, segs: Seg[], prevLast: string | null, prev?: Seg[] | null): { kind: PlanIssue; note: string }[] {
  const p = P.persons[pid], out: { kind: PlanIssue; note: string }[] = []; if (segs[0].act === 'offmap' && segs.length === 1) return out;
  let sleep = 0, off = 0, ill = 0; for (const s of segs) { const h = s.t1 - s.t0; if (s.act === 'sleep') sleep += h; else if (s.act === 'lie_ill') { sleep += h; ill += h; } else if (s.act === 'offmap') off += h; }
  if (sleep < 4 && off < 6) out.push({ kind: 'no_sleep', note: `${sleep.toFixed(1)} h asleep` });
  for (const s of segs) if (s.where !== 'road' && !reasonOk(s.act, s.why)) { out.push({ kind: 'reason', note: `${s.act} — ${s.why}` }); break; }
  // meals: adults awake for a working day
  if (P.ageOn(pid, d) >= 14 && ill < 6 && off === 0) {
    const awake = segs.filter(s => s.act !== 'sleep' && s.act !== 'lie_ill' && !NIGHT_FEED.test(s.why)); const wake = awake[0]?.t0 ?? 0, bed = awake[awake.length - 1]?.t1 ?? 0;
    const eats = segs.filter(s => s.act === 'eat');
    if (bed - wake >= 10) {
      if (eats.length < 2) out.push({ kind: 'meals', note: `${eats.length} meal(s) in ${(bed - wake).toFixed(1)} h awake` });
      else { let gap = 0; for (let i = 1; i < eats.length; i++) gap = Math.max(gap, eats[i].t0 - eats[i - 1].t1);
        const first = wake >= 3 ? eats[0].t0 - wake : 0;
        if (gap > 8) out.push({ kind: 'meals', note: `${gap.toFixed(1)} h between meals` }); else if (first > 4.5) out.push({ kind: 'meals', note: `first food ${first.toFixed(1)} h after waking` }); }
    }
  }
  const first = segs[0].place; if (d !== p.marry && prevLast && prevLast !== '-' && first !== '-' && segs[0].where !== 'road' && !prevLast.startsWith('road:') && prevLast !== first) out.push({ kind: 'teleport', note: `${prevLast} → ${first}` });
  out.push(...invariants(P, pid, d, segs, prev));
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

// ------------------------------------------------------------------ the year-wide invariants (D-191)
/** (a) the tolerance: a quarter of an hour of rain before the work is left (the rule's own quarter-hour grain) */
export const WEATHER_TOL_H = 0.25;
/** (a) out in the rain or the storm by rule: on the road (going home out of it, a courier: W-01), the watch kept at the post
 *  and on the round, the flock not left, a shelter taken, off the map */
const WET_OK = (s: Seg) => s.where === 'road' || s.act === 'stand_guard' || s.act === 'patrol' || s.act === 'shelter' || s.act === 'offmap'
  || ((s.act === 'herd' || s.act === 'tend_animals') && /^(flock:|pasture:|route:|road:)/.test(s.place)) || (/^(eat|rest)$/.test(s.act) && WET_OK_FLOCK.test(s.place)) || /waiting out the shower|the cloak drawn over|out of the rain|keeping watch over/.test(s.why);
/** (a) the dust: work goes on in it (W-03), and so does the rest that belongs to a working day out there (the midday rest at
 *  the field edge); leisure out of doors does not: talk, play, games, spinning and trade in the lane, at the well, in the
 *  court or the courtyard, and rest or sleep in the lane or the courtyard */
const DUST_IDLE = (s: Seg) => (/^(talk|play|gamble|spin|exchange)$/.test(s.act) && (/^(lane:|well:|forecourt|canal:|river|water)/.test(s.place) || OPEN_WHY.test(s.why)))
  || (/^(rest|sleep)$/.test(s.act) && (s.place.startsWith('lane:') || OPEN_WHY.test(s.why)));
/** (b) out-of-doors work that needs daylight */
export const LIGHT_ACTS = new Set<ActivityId>(['herd', 'tend_animals', 'field_work', 'reap', 'thresh', 'plough', 'dig_canal', 'irrigate', 'pick_fruit', 'garden_work', 'gather', 'craft',
  'write_tablet', 'dress_stone', 'mould_brick', 'lay_brick', 'haul', 'shear', 'slaughter', 'wash', 'gamble', 'exchange', 'spin', 'weave', 'polish_metal', 'work_wood', 'clean', 'train', 'inspect']);
const LIT = /lamp|torch|by the fire|the fire\b|moon/;
/** (b) work done in the dark by its nature (C): a night turn of the irrigation water, the flock watched at night by turns, the
 *  ewes at lambing */
const NIGHT_WORK = /night turn|in the night, by turns|at lambing/;
/** (c) the longest idle wait, and the waits that are part of the work (the porter standing by at the depot for the next
 *  load: the detailed tier turns it into carries while the depot holds stock, sim.ts) */
export const WAIT_CAP_H = 0.75;
const WAITING = /^waiting (for|at|while|out|until)\b|queue/;
const WAIT_OK = /^waiting at the depot for loads|^waiting out the shower/;
const over = (a: number, b: number, w: [number, number] | null) => (w ? Math.max(0, Math.min(b, w[1]) - Math.max(a, w[0])) : 0);
/** hours of [a, b] below outfits.COLD_C (the day's quarter-hour temperatures) */
function coldHours(wx: DayWx, a: number, b: number) {
  let c = 0; for (let q = Math.max(0, Math.floor(a * 4)); q < 96 && q * 0.25 < b; q++) { const x = Math.max(0, Math.min(b, q * 0.25 + 0.25) - Math.max(a, q * 0.25)); if (wx.tempQ[q] < COLD_C) c += x; }
  return c;
}
/** (d) reasons that assert a condition, and the condition: [name, the words, does it hold for this segment on this day] */
type LabelRule = [string, RegExp, (s: Seg, C: DayCtx, segs: Seg[], i: number) => boolean];
export const LABELS: LabelRule[] = [
  ['before the rains', /before the rains/, (s, C) => !C.firstRain],
  ['the heat', /\bthe heat\b|\bin the heat\b/, (s, C) => (C.heatRest || C.wx.tmax >= 30) && s.t1 > 10.5 && s.t0 < 18],
  ['through the heat', /through the heat/, (s, C, segs, i) => heatStretch(segs, i) >= 0.75], // (the stretch: a sleep woken by a feed is one)
  // (a day kept at home for the storm: a storm in the day's light, W-02; otherwise a storm within an hour and a half)
  ['the storm', /\bstorm\b/, (s, C) => /^(at home: storm|storm: )/.test(s.why) ? over(C.sun.rise - 0.5, C.sun.set + 0.5, C.wx.stormH) > 0 : over(s.t0 - 1.5, s.t1 + 1.5, C.wx.stormH) > 0],
  ['the dust', /\bdust\b(?! cakes)/, (s, C) => over(s.t0 - 1.5, s.t1 + 1.5, C.wx.dustH) > 0],
  ['the cold', /\bthe cold\b|against the cold/, (s, C) => C.wx.tmin < COLD_C],
  ['in the night', /(?<!fallen ill) in the night\b/, (s, C) => { const m = (s.t0 + s.t1) / 2; return m < C.sun.rise || m > C.sun.set; }],
  ['breakfast', /^breakfast\b/, s => s.t0 < 11.5],
  ['the midday meal', /^the midday meal\b/, s => s.t0 >= 9.5 && s.t0 <= 17],
  ['the evening meal', /^the evening meal\b/, (s, C) => s.t0 >= Math.min(15.5, C.sun.set - 2.5)],
  ['before leaving', /before leaving/, (s, C, segs, i) => { for (let j = i + 1; j < segs.length && segs[j].t0 < s.t1 + 0.75; j++) if (segs[j].where === 'road' || segs[j].place !== s.place) return true; return false; }],
  ['back from', /back from (the|gathering)/, (s, C, segs, i) => backFromOk(segs, i)],
];
const FEED = /nurs/;
/** the invariants (a)-(f) of one person's plan on one day; `prev` is yesterday's plan (for the night's feeds) */
export function invariants(P: Population, pid: number, d: number, segs: Seg[], prev?: Seg[] | null): { kind: PlanIssue; note: string }[] {
  const out: { kind: PlanIssue; note: string }[] = []; const C = P.cal.ctx(d), wx = C.wx, dawn = C.sun.rise - 0.45, dusk = C.sun.set + 0.45;
  const cold = wx.tempQ?.length ? Math.min(...wx.tempQ) < COLD_C : false; const n = (s: Seg) => `${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.act} @ ${s.place} — ${s.why}`;
  let waitRun = 0, waitStart = -1, waitPlace = '';
  for (let i = 0; i < segs.length; i++) { const s = segs[i], len = s.t1 - s.t0; if (len <= 1e-6) continue; const open = outdoors(s);
    // (a) weather
    if (open && s.with === undefined && !WET_OK(s) && (wx.rain || wx.stormH)) { const w = wetHours(wx, s.t0, s.t1); if (w > WEATHER_TOL_H) out.push({ kind: 'weather', note: `${w.toFixed(2)} h in the rain or the storm: ${n(s)}` }); }
    if (open && s.with === undefined && wx.dustH && DUST_IDLE(s) && s.where !== 'road' && over(s.t0, s.t1, wx.dustH) > WEATHER_TOL_H) out.push({ kind: 'weather', note: `at leisure out of doors in the dust: ${n(s)}` });
    // (b) light
    if (open && s.with === undefined && (LIGHT_ACTS.has(s.act) || (s.act === 'play' && /^(canal:|river|water)/.test(s.place))) && !LIT.test(s.why) && !NIGHT_WORK.test(s.why)) {
      const dark = Math.max(0, Math.min(s.t1, dawn) - s.t0) + Math.max(0, s.t1 - Math.max(s.t0, dusk)); if (dark > 0.25) out.push({ kind: 'light', note: `${dark.toFixed(2)} h in the dark: ${n(s)}` }); }
    // (c) waits (a run of waiting at one place)
    const waiting = s.with === undefined && (s.act === 'queue' || (WAITING.test(s.why) && !/^waiting on /.test(s.why))) && !WAIT_OK.test(s.why);
    if (waiting && waitStart >= 0 && waitPlace === s.place && Math.abs(segs[i - 1].t1 - s.t0) < 1e-6) waitRun += len; else if (waiting) { waitStart = s.t0; waitRun = len; waitPlace = s.place; } else waitStart = -1;
    const nx = segs[i + 1], goesOn = !!nx && nx.place === s.place && Math.abs(nx.t0 - s.t1) < 1e-6 && nx.with === undefined && (nx.act === 'queue' || (WAITING.test(nx.why) && !/^waiting on /.test(nx.why))) && !WAIT_OK.test(nx.why);
    if (waiting && waitRun > WAIT_CAP_H && !goesOn) out.push({ kind: 'wait', note: `${waitRun.toFixed(2)} h waiting from ${waitStart.toFixed(2)}: ${n(s)}` });
    // (d) labels
    for (const [name, re, ok] of LABELS) if (re.test(s.why) && !ok(s, C, segs, i)) out.push({ kind: 'label', note: `"${name}": ${n(s)}` });
    // (f) dress
    if (open && wx.dustH && s.act !== 'eat') { const o = over(s.t0, s.t1, wx.dustH), dw = /dust/.test(s.wear ?? '');
      if (!dw && o > 0.05) out.push({ kind: 'dress', note: `in the dust ${o.toFixed(2)} h unwrapped: ${n(s)}` });
      if (dw && len - o > 0.5) out.push({ kind: 'dress', note: `wrapped against the dust ${(len - o).toFixed(2)} h out of it: ${n(s)}` }); }
    if (/dust/.test(s.wear ?? '') && !wx.dustH) out.push({ kind: 'dress', note: `wrapped against the dust on a day with none: ${n(s)}` });
    const cw = /cold/.test(s.wear ?? '');
    if (open && cold) { const c = coldHours(wx, s.t0, s.t1);
      if (!cw && c > 0.25) out.push({ kind: 'dress', note: `in the cold ${c.toFixed(2)} h undressed for it: ${n(s)}` });
      if (cw && len - c > 0.5) out.push({ kind: 'dress', note: `dressed against the cold ${(len - c).toFixed(2)} h out of it: ${n(s)}` }); }
    else if (cw && !cold) out.push({ kind: 'dress', note: `dressed against the cold on a day with none: ${n(s)}` });
  }
  // (d) the labels that name the household: "with the household" has someone of it there, and "kept for the late-comer"
  // follows a meal the household began a quarter of an hour or more before
  if (segs.some(s => /with the household|kept for the late-comer/.test(s.why))) { const mem = P.membersOn(P.home(pid, d), d).filter(x => x !== pid && P.present(x, d));
    for (const s of segs) { if (s.t1 - s.t0 < 0.1 || s.where === 'road') continue;
      if (/with the household/.test(s.why)) { const at = (h: number) => mem.some(x => segAt(P.plan(x, d), h).place === s.place), e = Math.min(0.05, (s.t1 - s.t0) / 4);
        if (!at((s.t0 + s.t1) / 2) && !(at(s.t0 + e) && at(s.t1 - e))) out.push({ kind: 'label', note: `"with the household": ${n(s)}, no one of it there` }); }
      if (/kept for the late-comer/.test(s.why) && !mem.some(x => P.plan(x, d).some(o => o.act === 'eat' && /evening meal/.test(o.why) && o.place === s.place && o.t0 <= s.t0 - 0.25 && o.t0 > s.t0 - 4))) out.push({ kind: 'label', note: `"kept for the late-comer": ${n(s)}, the household had not eaten before` }); } }
  // (e) a baby's feeds (the woman who nurses it): by day and across the night, yesterday's last feeds counted
  const kids = P.nurslings(pid, d), babies = kids.filter(c => P.ageOn(c, d) === 0 && P.persons[c].born !== d);
  if (babies.length && !segs.some(s => s.act === 'offmap') && !(prev ?? []).some(s => s.act === 'offmap')) {
    const mo = Math.min(...babies.map(c => monthsOld(P, c, d))), capN = nightGapMax(mo), capD = IC.day_feed_every_h[1] + 0.4;
    const wake = segs.find(s => s.t0 > 2 && s.act !== 'sleep')?.t0 ?? 6, bed = [...segs].reverse().find(s => s.act !== 'sleep' && s.t1 < 24)?.t1 ?? 21;
    const fs: [number, number][] = []; if (prev) for (const s of prev) if (FEED.test(s.why)) fs.push([s.t0 - 24, s.t1 - 24]);
    for (const s of segs) if (FEED.test(s.why)) fs.push([s.t0, s.t1]);
    for (let i = 1; i < fs.length; i++) { const a = fs[i - 1][1], b = fs[i][0]; if (b < 0) continue; const m = (a + b) / 2, day = m >= wake && m <= bed, cap = day ? capD : capN;
      if (b - a > cap + 1e-6) out.push({ kind: 'feed', note: `${(b - a).toFixed(2)} h between feeds ${a.toFixed(2)}-${b.toFixed(2)} (${day ? 'day' : 'night'}, cap ${cap} h, ${mo.toFixed(1)} months)` }); }
  }
  return out;
}
