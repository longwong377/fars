// The court in residence (D-182; B12): only with the court setting; its numbers against population.json's court_resident
// values; its plans well formed; the royal guard holding its posts by the rota; every activity performed; deterministic.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, PLACES, type Env } from '../src/people/sim';
import { Population, segAt, type Seg } from '../src/people/population';
import { checkPlan, checkDay } from '../src/people/planCheck';
import { ACTIVITIES } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';
import { COURT, COURT_PLACES, COURT_SLOTS, NIGHT_SLOTS } from '../src/people/court';
import { WeatherSystem } from '../src/weather/weatherState';
import popData from '../src/data/population.json';
import sources from '../src/data/sources.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid, court: PeopleSim, absent: PeopleSim;
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  court = new PeopleSim(1, nav, env, { court: true }); absent = new PeopleSim(1, nav, env);
}, 120_000);
const TER = (popData as any).zones.find((z: any) => z.id === 'terrace').court_resident;
/** people whose plan puts them on the Terrace at hour h of day d */
function onTerrace(P: Population, d: number, h: number) { let n = 0; for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; if (segAt(P.plan(pid, d), h).where === 'terrace') n++; } return n; }

describe('the court in residence (D-182)', () => {
  it('exists only with the court setting, only while resident (days 0-116, gone from day 117)', () => {
    expect(absent.pop.court).toBeNull(); expect(absent.pop.persons.some(p => p.sub.startsWith('court:'))).toBe(false);
    const K = court.pop.court!; expect(K).not.toBeNull(); expect(K.end - K.first).toBeGreaterThan(4000);
    for (let pid = K.first; pid < K.end; pid += 97) { const p = court.pop.persons[pid]; expect(p.sub.startsWith('court:')).toBe(true);
      expect(court.pop.present(pid, 150)).toBe(false); expect(court.pop.present(pid, 300)).toBe(false); expect(p.leave).toBeLessThanOrEqual(117); }
    // on the leave day (E-26) the resident court goes down the road and is away by the evening
    const g = K.guards[3]; const s = court.pop.plan(g, 117); expect(segAt(s, 20).where).toBe('away');
    // everyone in the population before the court is unchanged in kind: the court's people come after them
    expect(court.pop.persons.slice(0, K.first).some(p => p.sub.startsWith('court:'))).toBe(false);
  });
  it('the Terrace holds population.json’s court-resident numbers by day and by night (within 20 % of the working value, inside the range)', () => {
    const P = court.pop, rows: string[] = [];
    for (const d of [0, 45, 100]) { const day = onTerrace(P, d, 10), night = onTerrace(P, d, 2); rows.push(`day ${d}: 10:00 ${day}, 02:00 ${night}`);
      expect(day).toBeGreaterThanOrEqual(Math.max(TER.day.all_seasons.range[0], 0.8 * TER.day.all_seasons.w)); expect(day).toBeLessThanOrEqual(Math.min(TER.day.all_seasons.range[1], 1.2 * TER.day.all_seasons.w));
      expect(night).toBeGreaterThanOrEqual(Math.max(TER.night.all_seasons.range[0], 0.8 * TER.night.all_seasons.w)); expect(night).toBeLessThanOrEqual(Math.min(TER.night.all_seasons.range[1], 1.2 * TER.night.all_seasons.w)); }
    // without the court the Terrace is the court-absent Terrace
    expect(onTerrace(absent.pop, 45, 10)).toBeLessThan(1200);
    console.log(rows.join('\n'));
  }, 300_000);
  it('the groups are as court.json sizes them; names from the attested pools by origin; sources resolve', () => {
    const K = court.pop.court!;
    for (const G of COURT.groups) expect(K.byGroup.get(G.id)?.length, G.id).toBe(G.n);
    expect(K.parties.length).toBeGreaterThan(200);
    for (const G of COURT.groups) for (const k of String(G.src).split(';')) expect((sources as any)[k], `${G.id}: ${k}`).toBeTruthy();
    for (const k of String(COURT.visitors.src).split(';')) expect((sources as any)[k], k).toBeTruthy();
    let named = 0; for (const pid of K.guards) if (court.pop.nameOf(pid)) named++; expect(named).toBe(K.guards.length); // Persian and Median: the Iranian pool
    for (const G of COURT.groups) expect(G.tier).toBe('C');
  });
  it('every court place is on the walkable Terrace, and the guard lines are files of posts on it', () => {
    for (const p of COURT_PLACES) { expect(PLACES[p.id], p.id).toBeTruthy(); expect(nav.walkable(p.at[0], p.at[1]), p.id).toBe(true); }
    expect(COURT_SLOTS.length).toBeGreaterThanOrEqual(20); expect(NIGHT_SLOTS.length).toBeGreaterThan(4);
    for (const s of COURT_SLOTS) { expect(s.posts.length).toBe(10); for (const q of s.posts) { const P = PLACES[q] as any; expect(P.kind).toBe('post'); expect(nav.lineClear(P.at, PLACES[P.anchor].at), q).toBe(true); } }
  });
  it('plans are well formed for every court person over a week (contiguous, registered and performed activities, sleep, meals, no teleport, walks under 3.1 h)', () => {
    const K = court.pop.court!, P = court.pop, issues: string[] = []; const acts = new Set<string>();
    for (let pid = K.first; pid < K.end; pid++) { let prev: string | null = null, prevD = -9;
      for (let d = 0; d < 7; d++) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d); let t = 0;
        for (const s of segs) { if (Math.abs(s.t0 - t) > 1e-6 || s.t1 < s.t0 - 1e-9) issues.push(`${pid} day ${d}: gap at ${s.t0}`); t = s.t1; acts.add(s.act);
          if (s.where === 'road' && s.t1 - s.t0 > 3.1) issues.push(`${pid} day ${d}: a ${(s.t1 - s.t0).toFixed(1)} h walk`); }
        if (Math.abs(t - 24) > 1e-6) issues.push(`${pid} day ${d}: ends at ${t}`);
        for (const x of checkPlan(P, pid, d, segs, prevD === d - 1 ? prev : null)) issues.push(`${pid} ${K.member(pid)?.g} day ${d}: ${x.kind} ${x.note}`);
        prev = segs[segs.length - 1].place; prevD = d; } }
    expect(issues.slice(0, 20)).toEqual([]);
    // every activity a court person does has a performance (the activity lint, no placeholder)
    for (const a of acts) { expect(ACTIVITIES[a as keyof typeof ACTIVITIES], a).toBeTruthy(); expect(ACTIVITIES[a as keyof typeof ACTIVITIES].placeholder, a).toBeFalsy(); }
    expect(activityLint(Object.fromEntries([...acts].map(a => [a, (ACTIVITIES as any)[a]])) as any)).toEqual([]);
    // the day checks (a person in two places, children alone) on two days, everyone
    for (const d of [2, 5]) { const cache = new Map<number, Seg[]>(); const planOf = (x: number) => { let v = cache.get(x); if (!v) { v = P.plan(x, d); cache.set(x, v); } return v; };
      expect(checkDay(P, d, planOf).filter(x => K.owns(x.pid))).toEqual([]); }
  }, 600_000);
  it('the king’s spearmen hold their posts by the rota: the watch’s files at their slots, one man in five away at his meal at most', () => {
    const K = court.pop.court!, P = court.pop;
    for (const [d, h, night] of [[10, 10, false], [10, 18, false], [11, 2, true], [60, 9, false]] as [number, number, boolean][]) {
      const rd = h < 6 ? d - 1 : d; let expected = 0, held = 0, wrong = 0;
      for (const pid of K.guards) { const post = K.postOf(pid, rd); const w = K.phase(pid, rd); if (post === null || w !== (h < 6 ? 2 : h < 14 ? 0 : 1)) continue; expected++;
        const s = segAt(P.plan(pid, d), h); if (s.act === 'stand_guard') { if (s.place === post) held++; else wrong++; } }
      const slots = night ? NIGHT_SLOTS.length : Math.min(20, COURT_SLOTS.length);
      expect(expected, `day ${d} ${h}:00`).toBeGreaterThanOrEqual(slots * 10 * 0.9); expect(wrong).toBe(0);
      expect(held / expected, `day ${d} ${h}:00`).toBeGreaterThanOrEqual(0.78);
    }
    // the posts move: a file holds a different stretch on its next watch of the same kind
    const f = P.persons[K.guards[0]].file; expect(K.slotOf(f, 0)).not.toBe(K.slotOf(f, 5));
  }, 120_000);
  it('is deterministic by seed', () => {
    const again = new PeopleSim(1, nav, env, { court: true }).pop, other: Population = new PeopleSim(2, nav, env, { court: true }).pop; const K = court.pop.court!;
    expect(again.persons.length).toBe(court.pop.persons.length); expect(again.court!.parties.length).toBe(K.parties.length);
    let same = 0, diff = 0;
    for (let pid = K.first; pid < K.end; pid += 211) { expect(JSON.stringify(again.plan(pid, 7))).toBe(JSON.stringify(court.pop.plan(pid, 7))); same++; }
    for (let i = 0; i < 20; i++) { const a = K.guards[i * 37]; if (other.persons[a]?.age !== court.pop.persons[a].age || other.nameOf(a) !== court.pop.nameOf(a)) diff++; }
    expect(same).toBeGreaterThan(20); expect(diff).toBeGreaterThan(5);
  }, 120_000);
});
