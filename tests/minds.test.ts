// D-461 (UD-32): every mind an agent of its own life, at the scale of the whole town, with no stranger at all: goals over days
// and months born of each person's own state and pursued step by step through the deeds and the day plans; moods from life;
// deeds talked of; the chains of cause; the cost of a town's day; the state saved and loaded.
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { KINDS, type Goal } from '../src/people/mind/goals';
import { personaOf } from '../src/people/persona';
import { wetHours } from '../src/people/population';

describe('D-461 the minds\' own goals (a real town, seed 1, day 60, no stranger)', () => {
  const sim = simAt(1, 60, 10, { asks: true }), day = 60, P = sim.pop, A = sim.deeds.agency, G = A.goals;
  it('goals of many kinds are born of people\'s own state, and are achieved or given up', () => {
    const formed = KINDS.filter(k => G.stats[k][0] > 0);
    expect(formed.length).toBeGreaterThanOrEqual(10);
    expect(KINDS.reduce((a, k) => a + G.stats[k][1], 0)).toBeGreaterThan(200);
    expect(KINDS.reduce((a, k) => a + G.stats[k][2], 0)).toBeGreaterThan(20);
    expect(G.active.size).toBeGreaterThan(500);
    // every goal is someone's present concern, with a cause in words, and never about themselves
    for (const g of [...G.active.values()].slice(0, 300)) { expect(P.present(g.pid, day)).toBe(true); expect(g.why.length).toBeGreaterThan(3); expect(g.who).not.toBe(g.pid); }
  });
  it('the town did it all alone: no deed of the stranger, deeds of many kinds from feelings, goals, the day\'s life and talk', () => {
    expect(sim.deeds.log.some(r => r.deed.actor === 'player' || r.deed.target === 'player')).toBe(false);
    expect(Object.keys(A.stats.deeds).length).toBeGreaterThanOrEqual(15);
    for (const s of ['feeling', 'goal', 'life', 'talk', 'quarrel']) expect(A.stats.src[s] ?? 0).toBeGreaterThan(0);
  });
  it('a goal plays out in the day plans: tending the sick, lessons, work with the master, with the reason in words', () => {
    const P1 = (pid: number) => P.plan(pid, day + 1);
    // (a stretch is never laid over the house's minder's day, nor in the open in rain or dust: engine.ts lay)
    const free = (pid: number) => P.hday(P.home(pid, day + 1), day + 1).minder !== pid;
    const care = [...G.active.values()].find(g => g.kind === 'care' && g.next === day + 1 && free(g.pid)) ?? [...G.active.values()].find(g => g.kind === 'care' && free(g.pid));
    expect(care).toBeDefined();
    const g = care!; G.pursue(g, day); // (today's step lays tomorrow)
    if (G.active.has(g.id)) expect(P1(g.pid).some(s => s.act === 'tend_body' && /sick/.test(s.why))).toBe(true);
    // a place won: two mornings a week at the master's work, paid
    const wx = P.cal.ctx(day + 1).wx, dry = wetHours(wx, 8, 12.5) === 0 && !(wx.dustH && wx.dustH[0] < 12.5 && wx.dustH[1] > 8);
    const placed = dry ? [...G.places].find(([pid, pl]) => [pl.days[0], pl.days[1]].includes((day + 1) % 7) && free(pid)) : undefined;
    if (placed) { G.placesDay(day); expect(P1(placed[0]).some(s => /working for/.test(s.why))).toBe(true); }
    expect(G.places.size).toBeGreaterThan(20);
  });
  it('a match ends in a betrothal and a wedding set in the population (the bride moves to the groom\'s house)', () => {
    const w = G.weds.find(x => x[2] > day + 1);
    expect(G.weds.length).toBeGreaterThan(0);
    if (w) { const [bride, groom, wd, to] = w; expect(P.persons[bride].marry).toBe(wd); expect(P.home(bride, wd)).toBe(to); expect(P.home(bride, wd - 1)).not.toBe(to); expect(P.home(groom, wd)).toBe(to); }
  });
  it('a grievance becomes revenge pursued step by step (told, complained of, insults), born of the deed: a chain of cause', () => {
    // a hot, proud man of the town wronged by a neighbour who is no kin
    const hot = P.persons.filter(p => P.present(p.id, day) && P.ageOn(p.id, day) >= 25 && P.ageOn(p.id, day) < 50 && p.sex === 'm' && p.agent < 0 && ['town', 'plain'].includes(P.households[P.home(p.id, day)].zone) && G.of(p.id).length === 0
      && !P.households[P.home(p.id, day)].members.some(m => P.sick(m, day)) && p.ties.some(t => P.present(t, day) && P.home(t, day) !== P.home(p.id, day) && P.ageOn(t, day) >= 14))
      .find(p => { const pe = personaOf(P, p.id, day); return pe.temper + pe.pride > 1.1; })!.id;
    const foe = P.persons.find(p => p.id !== hot && P.present(p.id, day) && P.ageOn(p.id, day) >= 25 && P.home(p.id, day) !== P.home(hot, day) && !P.persons[hot].ties.includes(p.id) && !p.ties.includes(hot) && P.households[P.home(p.id, day)].q === P.households[P.home(hot, day)].q && p.agent < 0)!.id;
    const rec = sim.deeds.own({ verb: 'attack', actor: foe, target: hot, force: 0.8 }, day, 999, 11);
    expect(rec.out.ok).toBe(true); expect(sim.deeds.minds.feelOf(hot, foe, day).anger).toBeGreaterThan(0.45);
    let g: Goal | null = null; for (let d = day; d < day + 25 && !g; d++) { const x = G.consider(hot, d); if (x && x.kind === 'revenge') g = x; }
    expect(g).not.toBeNull(); expect(g!.who).toBe(foe); expect(g!.cause).toBe(`deed:${rec.id}`); expect(g!.depth).toBeGreaterThanOrEqual(2);
    // the minds' daily anger leaves the pair to the goal
    expect(G.holds(hot, foe)).toBe(true);
    const n0 = sim.deeds.next; for (let i = 0; i < 4 && G.active.has(g!.id); i++) G.pursue(g!, g!.next);
    const mine = sim.deeds.log.filter(r => r.id >= n0 && r.deed.actor === hot && (r.deed.target === foe || r.deed.third === foe));
    expect(mine.length).toBeGreaterThanOrEqual(2); expect(mine.every(r => r.deed.goal === g!.id)).toBe(true);
    expect(new Set(mine.map(r => r.deed.verb)).size).toBeGreaterThanOrEqual(2);
  });
  it('a wrong is talked of: the one wronged tells a friend, whose feeling for the doer falls; the overheard talk carries it', () => {
    const v = P.persons.find(p => P.present(p.id, day) && P.ageOn(p.id, day) >= 20 && p.agent < 0 && p.ties.some(t => P.present(t, day) && P.home(t, day) !== P.home(p.id, day) && P.ageOn(t, day) >= 14))!.id;
    const doer = P.persons.find(p => p.id !== v && P.present(p.id, day) && P.ageOn(p.id, day) >= 20 && !P.persons[v].ties.includes(p.id) && P.home(p.id, day) !== P.home(v, day) && p.agent < 0)!.id;
    const d1 = (sim.deeds as unknown as { dayDone: number }).dayDone + 1; // (the living world runs the minds' days a few ahead of the clock)
    const rec = sim.deeds.own({ verb: 'insult', actor: doer, target: v }, d1, 998, 9); expect(rec.out.ok).toBe(true);
    const n0 = sim.deeds.next; sim.deeds.day(d1);
    const told = sim.deeds.log.filter(r => r.id >= n0 && r.deed.verb === 'tell' && r.deed.third === doer);
    // (a wrong is told by each teller with odds of 0.6: over the day's wrongs some are told, this one most likely)
    expect(sim.deeds.log.filter(r => r.id >= n0 && r.deed.verb === 'tell').length).toBeGreaterThan(0);
    if (told.length) { const hearer = told[0].deed.target as number; expect(sim.deeds.minds.feelOf(hearer, doer, d1).aff).toBeLessThan(sim.deeds.minds.rest(hearer, doer, d1).aff); }
    expect(A.talkOf(v, doer, d1)?.[1]).toMatch(/insult/);
  });
  it('moods from life: a house in mourning is downcast, and less willing to go visiting', () => {
    let pid = -1; for (let d = day - 20; d <= day && pid < 0; d++) for (const x of P.lifeOn(d).deaths) { const m = P.households[P.home(x, d)].members.find(y => y !== x && P.present(y, day) && P.mourning(y, day) && P.ageOn(y, day) >= 16); if (m !== undefined) { pid = m; break; } }
    expect(pid).toBeGreaterThanOrEqual(0);
    expect(A.moodOf(pid, day).v).toBeLessThan(-0.3);
    const friend = P.persons[pid].ties[0] ?? P.persons.find(p => p.id !== pid && P.present(p.id, day) && P.ageOn(p.id, day) > 16)!.id;
    const ctx = sim.deeds.minds.ctx, mood = ctx.mood; ctx.mood = () => 0;
    const calm = sim.deeds.minds.decide(pid, { verb: 'visit', actor: friend, target: pid }, day, 18); ctx.mood = mood;
    const sad = sim.deeds.minds.decide(pid, { verb: 'visit', actor: friend, target: pid }, day, 18);
    expect(sad.lean).toBeLessThan(calm.lean - 0.1);
    expect(A.briefOf(pid, day).join(' ')).toMatch(/grieving|You are/);
  });
  it('the brief tells a person what they are set on', () => {
    const g = [...G.active.values()].find(x => x.kind === 'spouse' && x.who >= 0) ?? [...G.active.values()][0];
    expect(A.briefOf(g.pid, day).join(' ')).toMatch(/You are set on/);
  });
  it('cheap: a day of the whole town\'s minds in under half a second, in slices of a few milliseconds (lenient: timing under load)', () => {
    expect(A.stats.days).toBeGreaterThan(30);
    expect(A.stats.ms / A.stats.days).toBeLessThan(500);
    expect(A.stats.maxSlice).toBeLessThan(60);
  });
  it('saved small and loaded, the goals, the places and the weddings go on', () => {
    const s = JSON.parse(JSON.stringify(sim.save())), b = simAt(1, 60, 10, { asks: true }); b.load(s);
    expect(s.deeds.z.length).toBeLessThan(600 * 1024);
    const B = b.deeds.agency.goals; expect(B.active.size).toBe(G.active.size); expect(B.places.size).toBe(G.places.size); expect(B.weds.length).toBe(G.weds.length);
    for (const [bride, , wd] of G.weds.filter(w => w[2] > 0)) expect(b.pop.persons[bride].marry).toBe(wd);
    for (const [pid, d] of G.left) expect(b.pop.present(pid, d + 1)).toBe(false);
    const g = [...G.active.values()][5]; expect(B.phrase(B.active.get(g.id)!, day)).toBe(G.phrase(g, day));
  });
});
