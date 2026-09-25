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
//  - stage:    (g) more than STAGE_CAP_H of a day on the move on foot (the road, a band coming down from the hills, a flock
//              moved on): a stage is what a family with its old and its little ones walks between camps (shadow review r8,
//              44216: 10 h 45 min from the hill camp to the first camp in the plain; C)
//  - flock:    (h) a herding man of a transhumant band (16–55, in the plain, not ill) whose day never touches the flock
//              (its fold, its grazing, its watch; shadow review r8, 44216: a day of donkeys and tents)
//  and the classes of the round-8 reviewers' other findings (D-197):
//  - sick:     (i) a sick little one (0-4) away from its house for more than SICK_AWAY_H of the day, or out of doors below
//              SICK_COLD_C for more than SICK_COLD_H (A S2, B S3: 91 % of sick child-days out at the mother's work, the lane at
//              2-7 °C); a guard at his family's house on a day his wife is ill who does none of the house's work (A S10, B S3)
//  - weatherday: (j) a Terrace worker kept at home by the weather on a day whose working window leaves DRY_WORK_H or more
//              dry (A S3, B S2: a storm at 15:30, as work ended, kept 612 builders at home)
//  - wait:     (c) also the detailed porters' stand at the depot, which is a wait by its words outside the hour before
//              the day's caravan and its carrying up (A S4: 4.0 h a day "waiting for a caravan" that had come)
//  - label:    (d) also "after dark" before the light has gone and "at dusk" away from it (A S7, B S8), one house named as
//              kin's, a friend's and a neighbour's in a day (B S8), the words of a day kept in by the weather away from the
//              weather (B S8), winnowing in still air (A S6), work taken home by a trade that has none of it (A S9)
//  - teen:     (k) a child of thirteen or more at play for more than children.work.teen_play_cap_h (B S4)
//  - siesta:   (l) from fourteen, more than HEAT_SLEEP_CAP_H asleep in the heat of the day (B S6)
//  - roofed:   (m) work under a roof (the Treasury, the closed palaces' doors) stopped at the E-64 noon (A S8)
//  - winnow:   (n) a farming man who threshed in the morning and is not on the floor in the afternoon's working wind (A S6)
import type { ActivityId } from './activities';
import type { Population, Seg } from './population';
import { segAt, OPEN_PLACE, OPEN_WHY, outdoors, wetHours, monthsOld, nightGapMax, heatStretch, WET_OK_FLOCK, backFromOk, NIGHT_FEED, workSpan, DRY_WORK_H, weatherWord, weatherNear, HEAT_SLEEP, HEAT_SLEEP_CAP_H } from './population';
export { OPEN_PLACE, OPEN_WHY, outdoors, wetHours, monthsOld, nightGapMax };
import type { DayWx, DayCtx } from './calendar';
import { COLD_C } from './outfits';
import livesData from '../data/lives.json';
const IC = (livesData as any).infant_care, LV = livesData as any;

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
export type PlanIssue = 'no_sleep' | 'reason' | 'meals' | 'teleport' | 'apart' | 'alone' | 'minding' | 'weather' | 'light' | 'wait' | 'label' | 'feed' | 'dress' | 'stage' | 'flock'
  | 'sick' | 'weatherday' | 'teen' | 'siesta' | 'roofed' | 'winnow';
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
  || ((s.act === 'herd' || s.act === 'tend_animals') && /^(flock:|pasture:|route:|road:)/.test(s.place)) || (s.act === 'eat' && s.place.startsWith('post_')) || (/^(eat|rest)$/.test(s.act) && WET_OK_FLOCK.test(s.place)) || /waiting out the shower|the cloak drawn over|out of the rain|keeping watch over/.test(s.why);
/** (a) the dust: work goes on in it (W-03), and so does the rest that belongs to a working day out there (the midday rest at
 *  the field edge); leisure out of doors does not: talk, play, games, spinning and trade in the lane, at the well, in the
 *  court or the courtyard, and rest or sleep in the lane or the courtyard */
const DUST_IDLE = (s: Seg) => !/^a dispute/.test(s.why) // (a quarrel at the well is part of the errand there)
  && ((/^(talk|play|gamble|spin|exchange)$/.test(s.act) && (/^(lane:|well:|forecourt|canal:|river|water)/.test(s.place) || OPEN_WHY.test(s.why)))
    || (/^(rest|sleep)$/.test(s.act) && (s.place.startsWith('lane:') || OPEN_WHY.test(s.why))));
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
const WAITING = /^waiting (for|at|while|out|until)\b/; // (and the queue itself: act 'queue')
// (and a delegation's turn at the Gate and in the Apadana: the audience's own procedure, the usher leading each party in
// turn, TREAS-AUD and the Apadana reliefs; the court setting only; C)
const WAIT_OK = /^waiting at the depot for loads|^waiting out the shower|waiting (in the forecourt )?to be (called|let through|heard|led before the king)|their party shown to the guards/;
const DEPOT = /^waiting at the depot for loads/;
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
  // (D-197: A S7 and B S8 of shadow review r8)
  ['after dark', /after dark/, (s, C) => s.t0 >= C.sun.set + 0.4 - 0.01],
  ['at dusk', /\bat dusk\b/, (s, C) => s.t1 > C.sun.set - 0.75 && s.t0 < C.sun.set + 0.75],
  ['kept in by the weather', /^(at home: )?(storm|rain)(: |$)|kept in by the (rain|storm)/, (s, C) => weatherNear(C.wx, weatherWord(s.why)!, s.t0, s.t1)],
  // (A S6: winnowing wants a wind, the half-day's: winnowing.wind_ms)
  ['winnowing', /winnow/, (s, C) => s.act !== 'thresh' || /too still to winnow/.test(s.why) || (/afternoon|evening/.test(s.why) || (s.t0 + s.t1) / 2 >= 13 ? C.wx.windPM : C.wx.windAM) >= LV.winnowing.wind_ms],
];
/** (d) the relation a house is named by: kin's, a friend's, a neighbour's (B S8 of shadow review r8) */
const REL = (why0: string) => { const why = why0.replace(/the kinswoman keeping the house/g, ''); return !/kin|friend|neighbour/.test(why) ? null : /kinswoman|\bkin\b|kinsman/.test(why) ? 'kin' : /\bfriend/.test(why) ? 'friend' : /neighbour’s|a neighbour\b/.test(why) && !/neighbours’ children|with neighbours|a neighbour of/.test(why) ? 'neighbour' : null; }; // (the one minding a child is no name of the house it is at)
/** (i) a sick little one's day away from its house and out in the cold (C) */
export const SICK_AWAY_H = 0.75, SICK_COLD_C = 5, SICK_COLD_H = 0.5;
/** (i) the house's work a man at home does for his sick wife (the water, the fire, the bread) */
const HOUSE_WORK = new Set<ActivityId>(['draw_water', 'carry_jar_head', 'carry_jar', 'cook', 'grind', 'knead', 'bake', 'gather']);
/** (j) the words of a Terrace worker's day kept at home by the weather */
const WEATHER_DAY = /no work on the building site today|no work on the Terrace today|no bread today/;
/** (m) work under a roof on the Terrace */
const ROOFED = /^(treasury_|palaces)/;
const FEED = /nurs/;
/** the invariants (a)-(f) of one person's plan on one day; `prev` is yesterday's plan (for the night's feeds) */
export function invariants(P: Population, pid: number, d: number, segs: Seg[], prev?: Seg[] | null): { kind: PlanIssue; note: string }[] {
  const out: { kind: PlanIssue; note: string }[] = []; const C = P.cal.ctx(d), wx = C.wx, dawn = C.sun.rise - 0.45, dusk = C.sun.set + 0.45;
  const cold = wx.tempQ?.length ? Math.min(...wx.tempQ) < COLD_C : false; const n = (s: Seg) => `${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.act} @ ${s.place} — ${s.why}`;
  let waitRun = 0, waitStart = -1, waitPlace = '';
  // (c) the depot's stand is the porter's work from the hour before the day's caravan until it is carried up (sim.ts carries
  // the depot's sacks while the plan holds him there); outside it, or on a day with no caravan after its first 1.5 h, a wait
  const dh = P.persons[pid].job === 'porter' ? P.depotHours(pid, d) : null;
  const depotWork = (x: Seg) => !!dh && x.t0 >= dh[0] - 0.25 && x.t1 <= dh[1] + 0.25;
  const waits = (x: Seg) => x.with === undefined && (x.act === 'queue' || (WAITING.test(x.why) && !/^waiting on /.test(x.why))) && (!WAIT_OK.test(x.why) || (DEPOT.test(x.why) && !depotWork(x)));
  for (let i = 0; i < segs.length; i++) { const s = segs[i], len = s.t1 - s.t0; if (len <= 1e-6) continue; const open = outdoors(s);
    // (a) weather
    if (open && s.with === undefined && !WET_OK(s) && (wx.rain || wx.stormH)) { const w = wetHours(wx, s.t0, s.t1); if (w > WEATHER_TOL_H) out.push({ kind: 'weather', note: `${w.toFixed(2)} h in the rain or the storm: ${n(s)}` }); }
    if (open && s.with === undefined && wx.dustH && DUST_IDLE(s) && s.where !== 'road' && over(s.t0, s.t1, wx.dustH) > WEATHER_TOL_H) out.push({ kind: 'weather', note: `at leisure out of doors in the dust: ${n(s)}` });
    // (b) light
    if (open && s.with === undefined && (LIGHT_ACTS.has(s.act) || (s.act === 'play' && /^(canal:|river|water)/.test(s.place))) && !LIT.test(s.why) && !NIGHT_WORK.test(s.why)) {
      const dark = Math.max(0, Math.min(s.t1, dawn) - s.t0) + Math.max(0, s.t1 - Math.max(s.t0, dusk)); if (dark > 0.25) out.push({ kind: 'light', note: `${dark.toFixed(2)} h in the dark: ${n(s)}` }); }
    // (c) waits (a run of waiting at one place)
    const waiting = waits(s);
    if (waiting && waitStart >= 0 && waitPlace === s.place && Math.abs(segs[i - 1].t1 - s.t0) < 1e-6) waitRun += len; else if (waiting) { waitStart = s.t0; waitRun = len; waitPlace = s.place; } else waitStart = -1;
    const nx = segs[i + 1], goesOn = !!nx && nx.place === s.place && Math.abs(nx.t0 - s.t1) < 1e-6 && waits(nx);
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
      if (cw && len - c > 0.5 && !(s.where === 'road' && len <= 1)) out.push({ kind: 'dress', note: `dressed against the cold ${(len - c).toFixed(2)} h out of it: ${n(s)}` }); } // (a cloak put on for a walk is not taken off on the way: a walk of an hour or less)
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
    const fs: [number, number][] = []; const had = d > 0 && babies.every(c => P.nurslings(pid, d - 1).includes(c)); // (yesterday's feeds count when the baby was hers yesterday: a wet-nursed baby comes to her on a day)
    if (prev && had) for (const s of prev) if (FEED.test(s.why)) fs.push([s.t0 - 24, s.t1 - 24]);
    for (const s of segs) if (FEED.test(s.why)) fs.push([s.t0, s.t1]);
    for (let i = 1; i < fs.length; i++) { const a = fs[i - 1][1], b = fs[i][0]; if (b < 0) continue; const m = (a + b) / 2, day = m >= wake && m <= bed, cap = day ? capD : capN;
      if (b - a > cap + 1e-6) out.push({ kind: 'feed', note: `${(b - a).toFixed(2)} h between feeds ${a.toFixed(2)}-${b.toFixed(2)} (${day ? 'day' : 'night'}, cap ${cap} h, ${mo.toFixed(1)} months)` }); }
  }
  // (g) the day's stage on foot
  // (walking on the road, and the off-map road and descent; a flock grazing as it goes is the herdsman's day, not a march)
  let moving = 0; for (const s of segs) if ((s.where === 'road' && (s.act === 'walk' || s.act === 'herd')) || (s.act === 'offmap' && MOVING_OFF.test(s.why))) moving += s.t1 - s.t0;
  if (moving > STAGE_CAP_H && !STAGE_OK.test(P.persons[pid].job)) out.push({ kind: 'stage', note: `${moving.toFixed(2)} h on the move on foot` });
  // (h) a herding man and the flock
  const pp = P.persons[pid], age = P.ageOn(pid, d);
  if (pp.job === 'herder' && pp.sex === 'm' && age >= 16 && age <= 55 && !segs.some(s => s.act === 'lie_ill') && segs.some(s => s.where === 'plain')
    && !segs.some(s => /^(flock:|route:)/.test(s.place) || /flock/.test(s.why)) && !(prev ?? []).some(s => s.t1 > 20 && /^flock:/.test(s.place)))
    out.push({ kind: 'flock', note: 'a herding man whose day never touches the flock' });
  // ---- D-197 (the round-8 reviewers' other findings, as classes)
  const Hh = P.households[P.home(pid, d)], sick = P.sick(pid, d), sum = (f: (x: Seg) => boolean) => segs.reduce((a, x) => a + (f(x) ? x.t1 - x.t0 : 0), 0);
  // (d) one house, one name in a day: kin's, a friend's or a neighbour's (a walk names the house it goes to)
  { const names = new Map<string, Set<string>>();
    for (let i = 0; i < segs.length; i++) { const k = REL(segs[i].why); if (!k) continue; // (a walk names where it goes, or where it comes from: "home from the neighbour's house")
      const pl = segs[i].where !== 'road' ? segs[i].place : /\bfrom\b/.test(segs[i].why) ? [...segs.slice(0, i)].reverse().find(x => x.where !== 'road')?.place : segs.slice(i + 1).find(x => x.where !== 'road')?.place;
      if (!pl || !pl.startsWith('h:') || pl === Hh.home) continue; (names.get(pl) ?? names.set(pl, new Set()).get(pl)!).add(k); }
    for (const [pl, v] of names) if (v.size > 1) out.push({ kind: 'label', note: `${pl} is named as ${[...v].join(' and ')} in one day` }); }
  // (d) work taken home by a trade that has it: the Treasury workshop's textile women (A S9)
  if (pp.job === 'treasury' && pp.sub !== 'textile' && segs.some(x => /spinning at home for the workshop/.test(x.why))) out.push({ kind: 'label', note: `"spinning at home for the workshop": a ${pp.sub} of the Treasury workshop` });
  // (i) a sick little one at home, out of the cold; a guard at home with his wife ill does some of her work
  if (pp.job === 'child' && age <= 4 && sick && (Hh.zone === 'town' || Hh.zone === 'plain') && !segs.some(x => /taken in by/.test(x.why))) {
    let away = 0, cold = 0; for (const x of segs) { const a = Math.max(5, x.t0), b = Math.min(21, x.t1); if (b <= a) continue;
      if (x.where !== 'road' && x.place !== Hh.home && x.place !== '-' && x.act !== 'offmap') away += b - a;
      if (outdoors(x)) for (let q = Math.floor(a * 4); q < 96 && q * 0.25 < b; q++) if (wx.tempQ[q] < SICK_COLD_C) cold += Math.max(0, Math.min(b, q * 0.25 + 0.25) - Math.max(a, q * 0.25)); }
    if (away > SICK_AWAY_H) out.push({ kind: 'sick', note: `a sick little one ${away.toFixed(2)} h away from its house` });
    if (cold > SICK_COLD_H) out.push({ kind: 'sick', note: `a sick little one ${cold.toFixed(2)} h out of doors below ${SICK_COLD_C} °C` }); }
  if (pp.job === 'guard' && Hh.zone === 'town' && !sick && P.membersOn(Hh.id, d).some(x => x !== pid && P.persons[x].sex === 'f' && P.ageOn(x, d) >= 14 && P.sick(x, d))
    && sum(x => x.place === Hh.home) >= 1.5 && !segs.some(x => HOUSE_WORK.has(x.act) && x.where !== 'terrace')) out.push({ kind: 'sick', note: 'a guard at his family’s house with his wife ill does none of the house’s work' });
  // (j) a Terrace worker kept at home by the weather on a day whose working window leaves DRY_WORK_H dry
  if (segs.some(x => WEATHER_DAY.test(x.why))) { const ws = P.terraceWindows(pid, d);
    if (ws.length && ws.every(({ w, roofed }) => workSpan(wx, w[0], w[1], roofed).dry >= DRY_WORK_H)) { const dry = ws.map(x => workSpan(wx, x.w[0], x.w[1], x.roofed).dry.toFixed(1)).join(' or '); out.push({ kind: 'weatherday', note: `kept at home by the weather with ${dry} h of the working window dry` }); } }
  // (j) and a farming man kept in by a storm while the day's field task has its dry working stretch (Population.dryTask)
  if (pp.job === 'farmer' && pp.sex === 'm' && age >= 16 && Hh.zone === 'plain' && segs.some(x => weatherWord(x.why) === 'storm') && P.hday(Hh.id, d).task) out.push({ kind: 'weatherday', note: 'kept in by a storm with the day’s field task left a dry stretch' });
  // (k) a child of thirteen or more at play
  // (minding the little ones is the house's work, not the minder's play)
  if (pp.job === 'child' && age >= 13) { const pl = sum(x => x.act === 'play' && x.where !== 'road' && !/^minding|with (the|her|his) little/.test(x.why)); if (pl > LV.children.work.teen_play_cap_h + 0.25) out.push({ kind: 'teen', note: `a child of ${age} at play ${pl.toFixed(2)} h` }); }
  // (l) the sleep in the heat of the day
  if (age >= 14) { const h = sum(x => x.act === 'sleep' && HEAT_SLEEP.test(x.why) && x.t1 > C.sun.rise + 2 && x.t0 < C.sun.set - 1); if (h > HEAT_SLEEP_CAP_H + 0.05) out.push({ kind: 'siesta', note: `${h.toFixed(2)} h asleep in the heat of the day` }); }
  // (m) work under a roof through the whole working day on a heat day (the noon stop is for the open)
  if (C.heatRest && (pp.work === 'treasury_inside' || pp.work === 'treasury_store' || pp.job === 'caretaker')) { const rf = segs.filter(x => ROOFED.test(x.place) && x.where !== 'road' && !['walk', 'carry_jar', 'eat'].includes(x.act) && !/nurs/.test(x.why)); // (a feed at the palace where she carries water is no roofed work)
    const ww = P.workWindow(C, true), sp = workSpan(wx, ww[0], ww[1], true);
    if (rf.length && rf[0].t0 < 11 && rf[rf.length - 1].t1 < 13 && sp.b >= 13 && !segs.some(x => /night duty|the lamps/.test(x.why))) out.push({ kind: 'roofed', note: `work under a roof stopped at ${rf[rf.length - 1].t1.toFixed(2)} on a heat day` }); }
  // (n) the afternoon's winnowing wind: a farming man who threshed in the morning goes back to the floor
  if (pp.job === 'farmer' && pp.sex === 'm' && age >= 16 && !sick && C.agri.has('E-43') && wx.windPM >= LV.winnowing.wind_ms) { const T = P.hday(Hh.id, d).task;
    if (T?.kind === 'thresh' && T.pm && wetHours(wx, T.pm[0], T.pm[1]) === 0 && sum(x => x.place.startsWith('threshing') && x.act === 'thresh' && x.t0 < 13) >= 1
      && !segs.some(x => x.place.startsWith('threshing') && x.act === 'thresh' && x.t1 > 14.5) && !segs.some(x => /grain heap|carrying grain to the storehouse/.test(x.why)))
      out.push({ kind: 'winnow', note: 'threshed in the morning and not on the floor in the afternoon’s wind' }); }
  return out;
}
/** (g) the cap on a day's stage on foot (C: a family's stage with its old and little ones, and a day's road walk) */
export const STAGE_CAP_H = 7;
const MOVING_OFF = /^(coming down from the hills|on the road)/;
/** jobs whose day on the road is longer by rule: couriers ride, drovers go on (C) */
const STAGE_OK = /^(courier|messenger)$/;
